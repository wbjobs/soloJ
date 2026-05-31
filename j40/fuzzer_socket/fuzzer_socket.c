#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <dlfcn.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <unistd.h>
#include <stdint.h>
#include <time.h>
#include <sys/shm.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <sys/mman.h>
#include <signal.h>
#include <execinfo.h>
#include <ucontext.h>
#include <sys/wait.h>
#include <errno.h>
#include <stdatomic.h>
#include <string.h>

#define COVERAGE_MAP_SIZE (1 << 16)
#define MAX_INPUT_SIZE 65536
#define MAX_FORK_SLOTS 64
#define FORK_SLOT_EMPTY 0
#define FORK_SLOT_ACTIVE 1
#define TAINT_MAP_SIZE (MAX_INPUT_SIZE / 8)
#define MAX_TAINT_BRANCHES 1024

typedef struct {
    uint64_t address;
    uint8_t taken;
    uint8_t byte_offsets[16];
    uint8_t num_bytes;
} taint_branch_t;

typedef struct {
    uint64_t address;
    uint64_t operand_a;
    uint64_t operand_b;
    uint8_t size;
    uint8_t is_signed;
    uint8_t a_taint_mask;
    uint8_t b_taint_mask;
} taint_cmp_t;

typedef struct {
    uint8_t  map[COVERAGE_MAP_SIZE];
    uint32_t prev_loc;
    uint32_t input_len;
    uint8_t  input[MAX_INPUT_SIZE];
    int      target_fd;
    int      is_target;
    uint8_t  taint_map[TAINT_MAP_SIZE];
    taint_branch_t taint_branches[MAX_TAINT_BRANCHES];
    uint32_t taint_branch_count;
    taint_cmp_t taint_cmps[256];
    uint32_t taint_cmp_count;
    uint64_t last_cmp_address;
} fuzzer_slot_t;

typedef struct {
    fuzzer_slot_t slots[MAX_FORK_SLOTS];
    _Atomic uint32_t slot_owners[MAX_FORK_SLOTS];
    _Atomic uint32_t next_slot;
    fuzzer_slot_t  parent_slot;
} fuzzer_shared_t;

static fuzzer_shared_t *fuzzer_shared = NULL;
static fuzzer_slot_t *fuzzer_ctx = NULL;
static int my_slot_idx = -1;
static int shm_id = -1;
static pid_t my_pid = 0;

typedef int (*socket_t)(int domain, int type, int protocol);
typedef ssize_t (*recv_t)(int sockfd, void *buf, size_t len, int flags);
typedef ssize_t (*send_t)(int sockfd, const void *buf, size_t len, int flags);
typedef int (*connect_t)(int sockfd, const struct sockaddr *addr, socklen_t addrlen);
typedef int (*close_t)(int fd);
typedef pid_t (*fork_t)(void);

static socket_t real_socket = NULL;
static recv_t real_recv = NULL;
static send_t real_send = NULL;
static connect_t real_connect = NULL;
static close_t real_close = NULL;
static fork_t real_fork = NULL;

static inline int taint_is_set(fuzzer_slot_t *ctx, size_t offset) {
    if (offset >= MAX_INPUT_SIZE) return 0;
    return (ctx->taint_map[offset / 8] & (1 << (offset % 8))) != 0;
}

static inline void taint_set(fuzzer_slot_t *ctx, size_t offset) {
    if (offset >= MAX_INPUT_SIZE) return;
    ctx->taint_map[offset / 8] |= 1 << (offset % 8);
}

static inline void taint_clear(fuzzer_slot_t *ctx, size_t offset) {
    if (offset >= MAX_INPUT_SIZE) return;
    ctx->taint_map[offset / 8] &= ~(1 << (offset % 8));
}

static void taint_set_range(fuzzer_slot_t *ctx, size_t start, size_t len) {
    for (size_t i = 0; i < len; i++) {
        taint_set(ctx, start + i);
    }
}

static void taint_propagate_copy(fuzzer_slot_t *ctx, size_t dst_offset, size_t src_offset, size_t len) {
    for (size_t i = 0; i < len; i++) {
        if (src_offset + i < MAX_INPUT_SIZE && dst_offset + i < MAX_INPUT_SIZE) {
            if (taint_is_set(ctx, src_offset + i)) {
                taint_set(ctx, dst_offset + i);
            } else {
                taint_clear(ctx, dst_offset + i);
            }
        }
    }
}

static uint8_t taint_get_mask(fuzzer_slot_t *ctx, size_t start, size_t len) {
    uint8_t mask = 0;
    for (size_t i = 0; i < len && i < 8; i++) {
        if (taint_is_set(ctx, start + i)) {
            mask |= 1 << i;
        }
    }
    return mask;
}

static void taint_record_branch(fuzzer_slot_t *ctx, uint64_t address, int taken, size_t affected_byte) {
    if (ctx->taint_branch_count >= MAX_TAINT_BRANCHES) return;
    
    taint_branch_t *branch = &ctx->taint_branches[ctx->taint_branch_count];
    branch->address = address;
    branch->taken = taken ? 1 : 0;
    branch->num_bytes = 0;
    
    for (int i = 0; i < ctx->taint_branch_count; i++) {
        if (ctx->taint_branches[i].address == address) {
            if (affected_byte < MAX_INPUT_SIZE) {
                int found = 0;
                for (int j = 0; j < ctx->taint_branches[i].num_bytes; j++) {
                    if (ctx->taint_branches[i].byte_offsets[j] == affected_byte) {
                        found = 1;
                        break;
                    }
                }
                if (!found && ctx->taint_branches[i].num_bytes < 16) {
                    ctx->taint_branches[i].byte_offsets[ctx->taint_branches[i].num_bytes++] = affected_byte;
                }
            }
            return;
        }
    }
    
    if (affected_byte < MAX_INPUT_SIZE) {
        branch->byte_offsets[branch->num_bytes++] = affected_byte;
    }
    ctx->taint_branch_count++;
}

static void taint_record_cmp(fuzzer_slot_t *ctx, uint64_t address, uint64_t a, uint64_t b, 
                             uint8_t size, int is_signed, uint8_t a_taint, uint8_t b_taint) {
    if (ctx->taint_cmp_count >= 256) return;
    
    taint_cmp_t *cmp = &ctx->taint_cmps[ctx->taint_cmp_count];
    cmp->address = address;
    cmp->operand_a = a;
    cmp->operand_b = b;
    cmp->size = size;
    cmp->is_signed = is_signed ? 1 : 0;
    cmp->a_taint_mask = a_taint;
    cmp->b_taint_mask = b_taint;
    ctx->taint_cmp_count++;
}

static void taint_reset(fuzzer_slot_t *ctx) {
    memset(ctx->taint_map, 0, TAINT_MAP_SIZE);
    ctx->taint_branch_count = 0;
    ctx->taint_cmp_count = 0;
    ctx->last_cmp_address = 0;
}

static fuzzer_slot_t *alloc_fork_slot(void) {
    if (!fuzzer_shared) return NULL;
    
    uint32_t slot = atomic_fetch_add(&fuzzer_shared->next_slot, 1);
    if (slot >= MAX_FORK_SLOTS) {
        fprintf(stderr, "[fuzzer] fork slot exhausted, using parent slot\n");
        return &fuzzer_shared->parent_slot;
    }
    
    atomic_store(&fuzzer_shared->slot_owners[slot], (uint32_t)getpid());
    my_slot_idx = (int)slot;
    return &fuzzer_shared->slots[slot];
}

static void init_real_functions(void) {
    real_socket = (socket_t)dlsym(RTLD_NEXT, "socket");
    real_recv = (recv_t)dlsym(RTLD_NEXT, "recv");
    real_send = (send_t)dlsym(RTLD_NEXT, "send");
    real_connect = (connect_t)dlsym(RTLD_NEXT, "connect");
    real_close = (close_t)dlsym(RTLD_NEXT, "close");
    real_fork = (fork_t)dlsym(RTLD_NEXT, "fork");
}

static void __attribute__((constructor)) init(void) {
    init_real_functions();
    
    my_pid = getpid();

    const char *shm_env = getenv("FUZZER_SHM_ID");
    if (shm_env) {
        shm_id = atoi(shm_env);
        if (shm_id > 0) {
            fuzzer_shared = (fuzzer_shared_t *)shmat(shm_id, NULL, 0);
            if (fuzzer_shared == (void *)-1) {
                perror("shmat");
                fuzzer_shared = NULL;
            }
        }
    }

    if (!fuzzer_shared) {
        fuzzer_shared = (fuzzer_shared_t *)mmap(
            NULL, sizeof(fuzzer_shared_t),
            PROT_READ | PROT_WRITE,
            MAP_SHARED | MAP_ANONYMOUS, -1, 0
        );
    }

    if (fuzzer_shared) {
        memset(&fuzzer_shared->parent_slot, 0, sizeof(fuzzer_slot_t));
        fuzzer_shared->parent_slot.target_fd = -1;
        
        uint32_t expected = 0;
        atomic_compare_exchange_strong(&fuzzer_shared->next_slot, &expected, 0);
    }
    
    fuzzer_ctx = &fuzzer_shared->parent_slot;
    my_slot_idx = -1;
}

static void __attribute__((destructor)) cleanup(void) {
    if (my_slot_idx >= 0 && fuzzer_shared) {
        atomic_store(&fuzzer_shared->slot_owners[my_slot_idx], FORK_SLOT_EMPTY);
        memset(&fuzzer_shared->slots[my_slot_idx], 0, sizeof(fuzzer_slot_t));
    }
    
    if (shm_id > 0 && fuzzer_shared) {
        shmdt(fuzzer_shared);
    }
}

static inline uint32_t get_location(void) {
    static uint32_t counter = 0;
    return __builtin_return_address(0) ? 
        ((uintptr_t)__builtin_return_address(0) & (COVERAGE_MAP_SIZE - 1)) : 
        (counter++ & (COVERAGE_MAP_SIZE - 1));
}

static void record_coverage(uint32_t cur_loc) {
    if (!fuzzer_ctx) return;
    
    uint32_t idx = fuzzer_ctx->prev_loc ^ cur_loc;
    if (fuzzer_ctx->map[idx] < 255) {
        fuzzer_ctx->map[idx]++;
    }
    fuzzer_ctx->prev_loc = cur_loc >> 1;
}

void __sanitizer_cov_trace_pc(void) {
    uint32_t loc = get_location();
    record_coverage(loc);
}

void __cyg_profile_func_enter(void *this_fn, void *call_site) {
    uint32_t loc = (uintptr_t)this_fn & (COVERAGE_MAP_SIZE - 1);
    record_coverage(loc);
}

void __cyg_profile_func_exit(void *this_fn, void *call_site) {
}

void __sanitizer_cov_trace_cmp1(uint8_t arg1, uint8_t arg2) {
    if (!fuzzer_ctx) return;
    uint64_t pc = (uintptr_t)__builtin_return_address(0);
    uint8_t a_taint = 0, b_taint = 0;
    
    for (size_t i = 0; i < MAX_INPUT_SIZE; i++) {
        if (taint_is_set(fuzzer_ctx, i)) {
            if (fuzzer_ctx->input[i] == arg1) a_taint = 1;
            if (fuzzer_ctx->input[i] == arg2) b_taint = 1;
        }
    }
    
    taint_record_cmp(fuzzer_ctx, pc, arg1, arg2, 1, 0, a_taint, b_taint);
}

void __sanitizer_cov_trace_cmp2(uint16_t arg1, uint16_t arg2) {
    if (!fuzzer_ctx) return;
    uint64_t pc = (uintptr_t)__builtin_return_address(0);
    uint8_t a_taint = taint_get_mask(fuzzer_ctx, 0, 2);
    uint8_t b_taint = 0;
    
    taint_record_cmp(fuzzer_ctx, pc, arg1, arg2, 2, 0, a_taint, b_taint);
}

void __sanitizer_cov_trace_cmp4(uint32_t arg1, uint32_t arg2) {
    if (!fuzzer_ctx) return;
    uint64_t pc = (uintptr_t)__builtin_return_address(0);
    uint8_t a_taint = taint_get_mask(fuzzer_ctx, 0, 4);
    uint8_t b_taint = 0;
    
    taint_record_cmp(fuzzer_ctx, pc, arg1, arg2, 4, 0, a_taint, b_taint);
}

void __sanitizer_cov_trace_cmp8(uint64_t arg1, uint64_t arg2) {
    if (!fuzzer_ctx) return;
    uint64_t pc = (uintptr_t)__builtin_return_address(0);
    uint8_t a_taint = taint_get_mask(fuzzer_ctx, 0, 8);
    uint8_t b_taint = 0;
    
    taint_record_cmp(fuzzer_ctx, pc, arg1, arg2, 8, 0, a_taint, b_taint);
}

int socket(int domain, int type, int protocol) {
    if (!real_socket) init_real_functions();
    
    int fd = real_socket(domain, type, protocol);
    
    const char *target_port = getenv("FUZZER_TARGET_PORT");
    if (target_port && domain == AF_INET && type == SOCK_STREAM) {
        if (fuzzer_ctx) {
            fuzzer_ctx->is_target = 1;
        }
    }
    
    return fd;
}

int connect(int sockfd, const struct sockaddr *addr, socklen_t addrlen) {
    if (!real_connect) init_real_functions();
    
    const char *target_port = getenv("FUZZER_TARGET_PORT");
    if (target_port && fuzzer_ctx) {
        fuzzer_ctx->target_fd = sockfd;
    }
    
    record_coverage(get_location());
    return real_connect(sockfd, addr, addrlen);
}

ssize_t recv(int sockfd, void *buf, size_t len, int flags) {
    if (!real_recv) init_real_functions();
    
    record_coverage(get_location());
    
    if (fuzzer_ctx && fuzzer_ctx->target_fd == sockfd && fuzzer_ctx->input_len > 0) {
        size_t copy_len = (len < fuzzer_ctx->input_len) ? len : fuzzer_ctx->input_len;
        memcpy(buf, fuzzer_ctx->input, copy_len);
        
        taint_reset(fuzzer_ctx);
        taint_set_range(fuzzer_ctx, 0, copy_len);
        
        size_t remaining = fuzzer_ctx->input_len - copy_len;
        if (remaining > 0) {
            memmove(fuzzer_ctx->input, fuzzer_ctx->input + copy_len, remaining);
        }
        fuzzer_ctx->input_len = remaining;
        
        return (ssize_t)copy_len;
    }
    
    return real_recv(sockfd, buf, len, flags);
}

ssize_t send(int sockfd, const void *buf, size_t len, int flags) {
    if (!real_send) init_real_functions();
    record_coverage(get_location());
    return real_send(sockfd, buf, len, flags);
}

int close(int fd) {
    if (!real_close) init_real_functions();
    
    if (fuzzer_ctx && fuzzer_ctx->target_fd == fd) {
        fuzzer_ctx->target_fd = -1;
    }
    
    return real_close(fd);
}

pid_t fork(void) {
    if (!real_fork) init_real_functions();
    
    pid_t pid = real_fork();
    
    if (pid == 0) {
        my_pid = getpid();
        
        fuzzer_slot_t *child_slot = alloc_fork_slot();
        if (child_slot) {
            fuzzer_ctx = child_slot;
            memset(fuzzer_ctx, 0, sizeof(fuzzer_slot_t));
            fuzzer_ctx->target_fd = -1;
        }
        
        if (fuzzer_shared) {
            fuzzer_slot_t *parent = &fuzzer_shared->parent_slot;
            if (parent->input_len > 0 && parent->input_len <= MAX_INPUT_SIZE) {
                memcpy(fuzzer_ctx->input, parent->input, parent->input_len);
                fuzzer_ctx->input_len = parent->input_len;
                memcpy(fuzzer_ctx->taint_map, parent->taint_map, TAINT_MAP_SIZE);
            }
        }
    } else if (pid > 0) {
        fuzzer_ctx->prev_loc = 0;
    }
    
    return pid;
}

static void reclaim_child_slots(pid_t child_pid) {
    if (!fuzzer_shared) return;
    
    for (int i = 0; i < MAX_FORK_SLOTS; i++) {
        uint32_t owner = atomic_load(&fuzzer_shared->slot_owners[i]);
        if (owner == (uint32_t)child_pid) {
            atomic_store(&fuzzer_shared->slot_owners[i], FORK_SLOT_EMPTY);
            
            for (int j = 0; j < COVERAGE_MAP_SIZE; j++) {
                if (fuzzer_shared->slots[i].map[j] != 0 &&
                    fuzzer_shared->parent_slot.map[j] == 0) {
                    fuzzer_shared->parent_slot.map[j] = fuzzer_shared->slots[i].map[j];
                }
            }
            
            memset(&fuzzer_shared->slots[i], 0, sizeof(fuzzer_slot_t));
        }
    }
}

pid_t waitpid(pid_t pid, int *wstatus, int options) {
    if (!real_fork) init_real_functions();
    pid_t (*real_waitpid)(pid_t, int*, int) = dlsym(RTLD_NEXT, "waitpid");
    
    pid_t ret = real_waitpid(pid, wstatus, options);
    
    if (ret > 0) {
        reclaim_child_slots(ret);
    }
    
    return ret;
}

static void crash_handler(int signo, siginfo_t *info, void *ucontext) {
    char buf[256];
    snprintf(buf, sizeof(buf), "/tmp/fuzzer_crash_%d_%ld.log", getpid(), time(NULL));
    FILE *f = fopen(buf, "w");
    if (f) {
        fprintf(f, "Signal: %d\n", signo);
        fprintf(f, "Address: %p\n", info->si_addr);
        fprintf(f, "PID: %d\n", getpid());
        fprintf(f, "Slot: %d\n", my_slot_idx);
        
        void *array[50];
        size_t size = backtrace(array, 50);
        backtrace_symbols_fd(array, size, fileno(f));
        
        ucontext_t *uc = (ucontext_t *)ucontext;
        #if defined(__x86_64__)
        fprintf(f, "RAX: 0x%llx\n", uc->uc_mcontext.gregs[REG_RAX]);
        fprintf(f, "RBX: 0x%llx\n", uc->uc_mcontext.gregs[REG_RBX]);
        fprintf(f, "RCX: 0x%llx\n", uc->uc_mcontext.gregs[REG_RCX]);
        fprintf(f, "RDX: 0x%llx\n", uc->uc_mcontext.gregs[REG_RDX]);
        fprintf(f, "RSI: 0x%llx\n", uc->uc_mcontext.gregs[REG_RSI]);
        fprintf(f, "RDI: 0x%llx\n", uc->uc_mcontext.gregs[REG_RDI]);
        fprintf(f, "RBP: 0x%llx\n", uc->uc_mcontext.gregs[REG_RBP]);
        fprintf(f, "RSP: 0x%llx\n", uc->uc_mcontext.gregs[REG_RSP]);
        fprintf(f, "RIP: 0x%llx\n", uc->uc_mcontext.gregs[REG_RIP]);
        #endif
        
        if (fuzzer_ctx) {
            fprintf(f, "\nInput (%u bytes):\n", fuzzer_ctx->input_len);
            for (size_t i = 0; i < fuzzer_ctx->input_len && i < 256; i++) {
                fprintf(f, "%02x ", fuzzer_ctx->input[i]);
                if ((i + 1) % 16 == 0) fprintf(f, "\n");
            }
            
            fprintf(f, "\nTaint bitmap (first 64 bytes):\n");
            for (size_t i = 0; i < 8; i++) {
                fprintf(f, "%02x ", fuzzer_ctx->taint_map[i]);
            }
        }
        
        fclose(f);
    }
    
    signal(signo, SIG_DFL);
    raise(signo);
}

__attribute__((constructor)) void setup_crash_handler(void) {
    struct sigaction sa;
    sa.sa_sigaction = crash_handler;
    sigemptyset(&sa.sa_mask);
    sa.sa_flags = SA_SIGINFO | SA_RESTART;
    
    sigaction(SIGSEGV, &sa, NULL);
    sigaction(SIGABRT, &sa, NULL);
    sigaction(SIGBUS, &sa, NULL);
    sigaction(SIGILL, &sa, NULL);
    sigaction(SIGFPE, &sa, NULL);
}
