#include "vmlinux.h"
#include <bpf/bpf_helpers.h>
#include <bpf/bpf_tracing.h>
#include <bpf/bpf_core_read.h>

#define MAX_PAYLOAD_SIZE 4096
#define MAX_SEGMENTS 4
#define TASK_COMM_LEN 16
#define MAX_TLS_RECORDS 8

char LICENSE[] SEC("license") = "GPL";

enum event_type {
    EVENT_SEND,
    EVENT_RECV,
    EVENT_TLS_WRITE,
    EVENT_TLS_READ,
    EVENT_TLS_HANDSHAKE,
};

enum tls_version {
    TLS_VERSION_UNKNOWN = 0,
    TLS_VERSION_1_0 = 0x0301,
    TLS_VERSION_1_1 = 0x0302,
    TLS_VERSION_1_2 = 0x0303,
    TLS_VERSION_1_3 = 0x0304,
};

enum tls_content_type {
    TLS_CONTENT_CHANGE_CIPHER_SPEC = 20,
    TLS_CONTENT_ALERT = 21,
    TLS_CONTENT_HANDSHAKE = 22,
    TLS_CONTENT_APPLICATION_DATA = 23,
    TLS_CONTENT_HEARTBEAT = 24,
};

struct tls_record {
    __u8 content_type;
    __u16 version;
    __u16 length;
    __u8 payload[512];
};

struct http_event {
    __u32 pid;
    __u32 tid;
    __u64 timestamp;
    __u32 type;
    char comm[TASK_COMM_LEN];
    __u32 payload_len;
    __u32 total_len;
    __u32 segment_count;
    __u32 is_segmented;
    char payload[MAX_PAYLOAD_SIZE];
    __u32 saddr;
    __u32 daddr;
    __u16 sport;
    __u16 dport;
    __u32 seq;
    __u32 is_tls;
    __u16 tls_version;
    __u8 tls_content_type;
    __u64 ssl_ctx_ptr;
};

struct {
    __uint(type, BPF_MAP_TYPE_PERF_EVENT_ARRAY);
    __uint(key_size, sizeof(__u32));
    __uint(value_size, sizeof(__u32));
} events SEC(".maps");

struct send_ctx {
    struct sock *sk;
    struct msghdr *msg;
    size_t size;
    __u32 seq;
};

struct {
    __uint(type, BPF_MAP_TYPE_HASH);
    __uint(max_entries, 8192);
    __type(key, __u32);
    __type(value, struct send_ctx);
} send_contexts SEC(".maps");

struct recv_ctx {
    struct sock *sk;
    struct msghdr *msg;
    __u32 seq;
};

struct {
    __uint(type, BPF_MAP_TYPE_HASH);
    __uint(max_entries, 8192);
    __type(key, __u32);
    __type(value, struct recv_ctx);
} recv_contexts SEC(".maps");

struct tls_write_ctx {
    void *ssl;
    const void *buf;
    size_t size;
    __u32 seq;
};

struct {
    __uint(type, BPF_MAP_TYPE_HASH);
    __uint(max_entries, 8192);
    __type(key, __u32);
    __type(value, struct tls_write_ctx);
} tls_write_contexts SEC(".maps");

struct tls_read_ctx {
    void *ssl;
    void *buf;
    size_t size;
    __u32 seq;
};

struct {
    __uint(type, BPF_MAP_TYPE_HASH);
    __uint(max_entries, 8192);
    __type(key, __u32);
    __type(value, struct tls_read_ctx);
} tls_read_contexts SEC(".maps");

struct ssl_socket_map {
    __uint(type, BPF_MAP_TYPE_HASH);
    __uint(max_entries, 65536);
    __type(key, __u64);
    __type(value, struct sock *);
} ssl_to_socket SEC(".maps");

struct seq_counter {
    __u32 counter;
};

struct {
    __uint(type, BPF_MAP_TYPE_ARRAY);
    __uint(max_entries, 1);
    __type(key, __u32);
    __type(value, struct seq_counter);
} seq_counters SEC(".maps");

static __always_inline __u16 bpf_htons(__u16 val)
{
    return (val << 8) | (val >> 8);
}

static __always_inline __u16 bpf_ntohs(__u16 val)
{
    return (val << 8) | (val >> 8);
}

static __always_inline __u32 get_seq(void)
{
    __u32 key = 0;
    struct seq_counter *counter = bpf_map_lookup_elem(&seq_counters, &key);
    if (!counter) {
        struct seq_counter new_counter = {.counter = 0};
        bpf_map_update_elem(&seq_counters, &key, &new_counter, BPF_ANY);
        return 0;
    }
    __u32 seq = counter->counter++;
    return seq;
}

static __always_inline void extract_socket_info(struct sock *sk, struct http_event *event)
{
    if (!sk) return;
    
    struct sock_common *skc = (struct sock_common *)sk;
    __u16 dport = 0;
    __u16 num = 0;
    
    bpf_probe_read_kernel(&dport, sizeof(dport), &skc->skc_dport);
    bpf_probe_read_kernel(&num, sizeof(num), &sk->sk_num);
    
    event->dport = bpf_htons(dport);
    event->sport = num;
    
    bpf_probe_read_kernel(&event->daddr, sizeof(event->daddr), &skc->skc_daddr);
    bpf_probe_read_kernel(&event->saddr, sizeof(event->saddr), &skc->skc_rcv_saddr);
}

static __always_inline int read_iov_data(struct msghdr *msg, char *buf, __u32 buf_size, __u32 *total_read)
{
    if (!msg) return -1;
    
    struct iov_iter iter;
    struct iovec *iov = NULL;
    void *iov_base = NULL;
    __u64 iov_len = 0;
    __u32 offset = 0;
    
    bpf_probe_read_kernel(&iter, sizeof(iter), &msg->msg_iter);
    
    __u64 nr_segs = 0;
    bpf_probe_read_kernel(&nr_segs, sizeof(nr_segs), &iter.nr_segs);
    
    if (nr_segs == 0 || nr_segs > MAX_SEGMENTS) {
        nr_segs = 1;
    }
    
    iov = iter.iov;
    
    #pragma unroll
    for (int i = 0; i < MAX_SEGMENTS; i++) {
        if (i >= nr_segs) break;
        
        struct iovec iov_copy;
        if (bpf_probe_read_kernel(&iov_copy, sizeof(iov_copy), &iov[i]) < 0) {
            break;
        }
        
        iov_base = iov_copy.iov_base;
        iov_len = iov_copy.iov_len;
        
        if (!iov_base || iov_len == 0) continue;
        
        __u32 copy_len = iov_len;
        if (offset + copy_len > buf_size) {
            copy_len = buf_size - offset;
        }
        
        if (copy_len == 0) break;
        
        if (bpf_probe_read(&buf[offset], copy_len, iov_base) < 0) {
            break;
        }
        
        offset += copy_len;
        
        if (offset >= buf_size) break;
    }
    
    *total_read = offset;
    return 0;
}

static __always_inline __u16 detect_tls_version(const __u8 *data, __u32 len)
{
    if (len < 5) return TLS_VERSION_UNKNOWN;
    
    __u8 content_type = data[0];
    if (content_type < 20 || content_type > 24) {
        return TLS_VERSION_UNKNOWN;
    }
    
    __u16 version = bpf_ntohs(*(__u16 *)(data + 1));
    
    if (version == TLS_VERSION_1_3 || 
        version == TLS_VERSION_1_2 || 
        version == TLS_VERSION_1_1 || 
        version == TLS_VERSION_1_0) {
        return version;
    }
    
    if (data[1] == 0x03 && (data[2] >= 0x01 && data[2] <= 0x04)) {
        return (__u16)(data[1] << 8 | data[2]);
    }
    
    return TLS_VERSION_UNKNOWN;
}

SEC("kprobe/tcp_sendmsg")
int BPF_KPROBE(tcp_sendmsg_entry, struct sock *sk, struct msghdr *msg, size_t size)
{
    __u32 tid = bpf_get_current_pid_tgid();
    __u32 seq = get_seq();
    
    struct send_ctx ctx = {
        .sk = sk,
        .msg = msg,
        .size = size,
        .seq = seq,
    };
    
    bpf_map_update_elem(&send_contexts, &tid, &ctx, BPF_ANY);
    
    return 0;
}

SEC("kretprobe/tcp_sendmsg")
int BPF_KRETPROBE(tcp_sendmsg_exit, int ret)
{
    if (ret <= 0) {
        return 0;
    }
    
    __u32 tid = bpf_get_current_pid_tgid();
    struct send_ctx *ctx = bpf_map_lookup_elem(&send_contexts, &tid);
    if (!ctx) {
        return 0;
    }
    
    struct http_event event = {};
    event.pid = bpf_get_current_pid_tgid() >> 32;
    event.tid = tid & 0xFFFFFFFF;
    event.timestamp = bpf_ktime_get_ns();
    event.type = EVENT_SEND;
    event.total_len = ret;
    event.seq = ctx->seq;
    
    if (ret > MAX_PAYLOAD_SIZE) {
        event.is_segmented = 1;
        event.payload_len = MAX_PAYLOAD_SIZE;
    } else {
        event.is_segmented = 0;
        event.payload_len = ret;
    }
    
    bpf_get_current_comm(&event.comm, sizeof(event.comm));
    extract_socket_info(ctx->sk, &event);
    
    __u32 total_read = 0;
    if (ctx->msg) {
        read_iov_data(ctx->msg, event.payload, MAX_PAYLOAD_SIZE, &total_read);
        if (total_read > 0) {
            event.payload_len = total_read > MAX_PAYLOAD_SIZE ? MAX_PAYLOAD_SIZE : total_read;
            
            __u16 tls_ver = detect_tls_version((__u8 *)event.payload, event.payload_len);
            if (tls_ver != TLS_VERSION_UNKNOWN) {
                event.is_tls = 1;
                event.tls_version = tls_ver;
                event.tls_content_type = event.payload[0];
            }
        }
    }
    
    bpf_perf_event_output(ctx, &events, BPF_F_CURRENT_CPU, &event, sizeof(event));
    bpf_map_delete_elem(&send_contexts, &tid);
    
    return 0;
}

SEC("kprobe/tcp_recvmsg")
int BPF_KPROBE(tcp_recvmsg_entry, struct sock *sk, struct msghdr *msg)
{
    __u32 tid = bpf_get_current_pid_tgid();
    __u32 seq = get_seq();
    
    struct recv_ctx ctx = {
        .sk = sk,
        .msg = msg,
        .seq = seq,
    };
    
    bpf_map_update_elem(&recv_contexts, &tid, &ctx, BPF_ANY);
    
    return 0;
}

SEC("kretprobe/tcp_recvmsg")
int BPF_KRETPROBE(tcp_recvmsg_exit, int ret)
{
    if (ret <= 0) {
        return 0;
    }
    
    __u32 tid = bpf_get_current_pid_tgid();
    struct recv_ctx *ctx = bpf_map_lookup_elem(&recv_contexts, &tid);
    if (!ctx) {
        return 0;
    }
    
    struct http_event event = {};
    event.pid = bpf_get_current_pid_tgid() >> 32;
    event.tid = tid & 0xFFFFFFFF;
    event.timestamp = bpf_ktime_get_ns();
    event.type = EVENT_RECV;
    event.total_len = ret;
    event.seq = ctx->seq;
    
    if (ret > MAX_PAYLOAD_SIZE) {
        event.is_segmented = 1;
        event.payload_len = MAX_PAYLOAD_SIZE;
    } else {
        event.is_segmented = 0;
        event.payload_len = ret;
    }
    
    bpf_get_current_comm(&event.comm, sizeof(event.comm));
    extract_socket_info(ctx->sk, &event);
    
    __u32 total_read = 0;
    if (ctx->msg) {
        read_iov_data(ctx->msg, event.payload, MAX_PAYLOAD_SIZE, &total_read);
        if (total_read > 0) {
            event.payload_len = total_read > MAX_PAYLOAD_SIZE ? MAX_PAYLOAD_SIZE : total_read;
            
            __u16 tls_ver = detect_tls_version((__u8 *)event.payload, event.payload_len);
            if (tls_ver != TLS_VERSION_UNKNOWN) {
                event.is_tls = 1;
                event.tls_version = tls_ver;
                event.tls_content_type = event.payload[0];
            }
        }
    }
    
    bpf_perf_event_output(ctx, &events, BPF_F_CURRENT_CPU, &event, sizeof(event));
    bpf_map_delete_elem(&recv_contexts, &tid);
    
    return 0;
}

SEC("uprobe/SSL_write")
int BPF_UPROBE(SSL_write_entry, void *ssl, const void *buf, int num)
{
    __u32 tid = bpf_get_current_pid_tgid();
    __u32 seq = get_seq();
    
    struct tls_write_ctx ctx = {
        .ssl = ssl,
        .buf = buf,
        .size = num,
        .seq = seq,
    };
    
    bpf_map_update_elem(&tls_write_contexts, &tid, &ctx, BPF_ANY);
    
    return 0;
}

SEC("uretprobe/SSL_write")
int BPF_URETPROBE(SSL_write_exit, int ret)
{
    if (ret <= 0) {
        return 0;
    }
    
    __u32 tid = bpf_get_current_pid_tgid();
    struct tls_write_ctx *ctx = bpf_map_lookup_elem(&tls_write_contexts, &tid);
    if (!ctx) {
        return 0;
    }
    
    struct http_event event = {};
    event.pid = bpf_get_current_pid_tgid() >> 32;
    event.tid = tid & 0xFFFFFFFF;
    event.timestamp = bpf_ktime_get_ns();
    event.type = EVENT_TLS_WRITE;
    event.total_len = ret;
    event.seq = ctx->seq;
    event.is_tls = 1;
    event.ssl_ctx_ptr = (__u64)ctx->ssl;
    
    event.payload_len = ret > MAX_PAYLOAD_SIZE ? MAX_PAYLOAD_SIZE : ret;
    
    bpf_get_current_comm(&event.comm, sizeof(event.comm));
    
    if (ctx->buf && ret > 0) {
        __u32 copy_len = ret > MAX_PAYLOAD_SIZE ? MAX_PAYLOAD_SIZE : ret;
        bpf_probe_read(&event.payload, copy_len, ctx->buf);
        event.payload_len = copy_len;
    }
    
    bpf_perf_event_output(ctx, &events, BPF_F_CURRENT_CPU, &event, sizeof(event));
    bpf_map_delete_elem(&tls_write_contexts, &tid);
    
    return 0;
}

SEC("uprobe/SSL_read")
int BPF_UPROBE(SSL_read_entry, void *ssl, void *buf, int num)
{
    __u32 tid = bpf_get_current_pid_tgid();
    __u32 seq = get_seq();
    
    struct tls_read_ctx ctx = {
        .ssl = ssl,
        .buf = buf,
        .size = num,
        .seq = seq,
    };
    
    bpf_map_update_elem(&tls_read_contexts, &tid, &ctx, BPF_ANY);
    
    return 0;
}

SEC("uretprobe/SSL_read")
int BPF_URETPROBE(SSL_read_exit, int ret)
{
    if (ret <= 0) {
        return 0;
    }
    
    __u32 tid = bpf_get_current_pid_tgid();
    struct tls_read_ctx *ctx = bpf_map_lookup_elem(&tls_read_contexts, &tid);
    if (!ctx) {
        return 0;
    }
    
    struct http_event event = {};
    event.pid = bpf_get_current_pid_tgid() >> 32;
    event.tid = tid & 0xFFFFFFFF;
    event.timestamp = bpf_ktime_get_ns();
    event.type = EVENT_TLS_READ;
    event.total_len = ret;
    event.seq = ctx->seq;
    event.is_tls = 1;
    event.ssl_ctx_ptr = (__u64)ctx->ssl;
    
    event.payload_len = ret > MAX_PAYLOAD_SIZE ? MAX_PAYLOAD_SIZE : ret;
    
    bpf_get_current_comm(&event.comm, sizeof(event.comm));
    
    if (ctx->buf && ret > 0) {
        __u32 copy_len = ret > MAX_PAYLOAD_SIZE ? MAX_PAYLOAD_SIZE : ret;
        bpf_probe_read(&event.payload, copy_len, ctx->buf);
        event.payload_len = copy_len;
    }
    
    bpf_perf_event_output(ctx, &events, BPF_F_CURRENT_CPU, &event, sizeof(event));
    bpf_map_delete_elem(&tls_read_contexts, &tid);
    
    return 0;
}
