load("@proxy_wasm_cpp_sdk//bazel:defs.bzl", "proxy_wasm_cc_binary")

package(default_visibility = ["//visibility:public"])

config_setting(
    name = "enable_gpu",
    values = {"define": "enable_gpu=true"},
)

cc_library(
    name = "inference_engine",
    srcs = ["src/inference_engine.cc"],
    hdrs = ["include/inference_engine.h"],
    includes = ["include"],
    deps = [
        "@com_google_tensorflow//tensorflow/lite:framework",
        "@com_google_tensorflow//tensorflow/lite/kernels:builtin_ops",
        "@com_google_absl//absl/strings",
    ] + select({
        ":enable_gpu": [
            "@com_google_tensorflow//tensorflow/lite/delegates/gpu:delegate",
        ],
        "//conditions:default": [],
    }),
    defines = select({
        ":enable_gpu": ["ENABLE_GPU"],
        "//conditions:default": [],
    }),
)

cc_library(
    name = "route_config",
    srcs = ["src/route_config.cc"],
    hdrs = ["include/route_config.h"],
    includes = ["include"],
    deps = [
        "@com_github_nlohmann_json//:nlohmann_json",
    ],
)

cc_library(
    name = "inference_cache",
    srcs = ["src/inference_cache.cc"],
    hdrs = ["include/inference_cache.h"],
    includes = ["include"],
)

cc_library(
    name = "pipeline_config",
    srcs = ["src/pipeline_config.cc"],
    hdrs = ["include/pipeline_config.h"],
    includes = ["include"],
    deps = [
        "@com_github_nlohmann_json//:nlohmann_json",
    ],
)

cc_library(
    name = "pipeline_executor",
    srcs = ["src/pipeline_executor.cc"],
    hdrs = ["include/pipeline_executor.h"],
    includes = ["include"],
    deps = [
        ":inference_engine",
        ":inference_cache",
        ":pipeline_config",
        "@com_github_nlohmann_json//:nlohmann_json",
    ],
)

proxy_wasm_cc_binary(
    name = "ai_gateway_filter",
    srcs = [
        "src/ai_gateway_filter.cc",
    ],
    deps = [
        ":inference_engine",
        ":route_config",
        ":inference_cache",
        ":pipeline_config",
        ":pipeline_executor",
        "@proxy_wasm_cpp_sdk//:proxy_wasm_intrinsics",
        "@com_github_nlohmann_json//:nlohmann_json",
    ],
    visibility = ["//visibility:public"],
)

sh_binary(
    name = "build_wasm",
    srcs = ["scripts/build_wasm.sh"],
)
