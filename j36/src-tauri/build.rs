fn main() {
    tauri_build::build();
    println!("cargo:rerun-if-changed=../cpp");
    
    let mut build = cc::Build::new();
    build.cpp(true);
    build.include("../cpp");
    build.include("../cpp/nlohmann");
    build.flag_if_supported("-std=c++17");
    build.flag_if_supported("-O2");
    
    build.file("../cpp/style_rearranger.cpp");
    
    build.define("NLOHMANN_JSON_HEADER_ONLY", None);
    
    let target = std::env::var("TARGET").unwrap_or_default();
    if target.contains("windows") {
        build.define("_WIN32", None);
        build.static_crt(true);
    }
    
    build.compile("style_rearranger");
    
    println!("cargo:rustc-link-lib=static=style_rearranger");
    
    if target.contains("linux") {
        println!("cargo:rustc-link-lib=dylib=stdc++");
    } else if target.contains("darwin") {
        println!("cargo:rustc-link-lib=dylib=c++");
    }
    
    println!("cargo:rerun-if-changed=../cpp/style_rearranger.h");
    println!("cargo:rerun-if-changed=../cpp/style_rearranger.cpp");
    println!("cargo:rerun-if-changed=../cpp/nlohmann/json.hpp");
}
