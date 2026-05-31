#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/socket.h>
#include <netinet/in.h>

#define PORT 8080
#define BUFFER_SIZE 1024

void handle_request(int client_socket) {
    char buffer[BUFFER_SIZE];
    char path[256];
    ssize_t n;

    n = recv(client_socket, buffer, sizeof(buffer) - 1, 0);
    if (n <= 0) {
        close(client_socket);
        return;
    }
    buffer[n] = '\0';

    if (sscanf(buffer, "GET %255s", path) == 1) {
        if (strncmp(path, "/api/v1/test?param=", 20) == 0) {
            char user_input[64];
            strcpy(user_input, path + 20);
            
            if (strstr(user_input, "crash") != NULL) {
                printf("[!] Triggering crash...\n");
                int *p = NULL;
                *p = 0xdeadbeef;
            }
            
            if (strstr(user_input, "overflow") != NULL) {
                printf("[!] Triggering buffer overflow...\n");
                char small_buf[16];
                strcpy(small_buf, user_input);
                printf("Input: %s\n", small_buf);
            }
            
            if (strstr(user_input, "uaf") != NULL) {
                printf("[!] Triggering use-after-free...\n");
                char *ptr = malloc(64);
                strcpy(ptr, "test");
                free(ptr);
                ptr[0] = 'A';
            }
        }

        const char *response = "HTTP/1.1 200 OK\r\nContent-Length: 13\r\n\r\nHello, World!";
        send(client_socket, response, strlen(response), 0);
    }

    close(client_socket);
}

int main() {
    int server_fd, client_socket;
    struct sockaddr_in address;
    int opt = 1;
    int addrlen = sizeof(address);

    if ((server_fd = socket(AF_INET, SOCK_STREAM, 0)) == 0) {
        perror("socket failed");
        exit(EXIT_FAILURE);
    }

    if (setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR | SO_REUSEPORT, &opt, sizeof(opt))) {
        perror("setsockopt");
        exit(EXIT_FAILURE);
    }

    address.sin_family = AF_INET;
    address.sin_addr.s_addr = INADDR_ANY;
    address.sin_port = htons(PORT);

    if (bind(server_fd, (struct sockaddr *)&address, sizeof(address)) < 0) {
        perror("bind failed");
        exit(EXIT_FAILURE);
    }

    if (listen(server_fd, 3) < 0) {
        perror("listen");
        exit(EXIT_FAILURE);
    }

    printf("Vulnerable server listening on port %d\n", PORT);

    while (1) {
        if ((client_socket = accept(server_fd, (struct sockaddr *)&address, (socklen_t*)&addrlen)) < 0) {
            perror("accept");
            continue;
        }
        handle_request(client_socket);
    }

    return 0;
}
