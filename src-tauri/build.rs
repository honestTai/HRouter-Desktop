fn main() {
    tauri_build::build();

    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        build_macos_widget_bridge();
    }

    // Windows: Embed Common Controls v6 manifest for test binaries
    //
    // When running `cargo test`, the generated test executables don't include
    // the standard Tauri application manifest. Without Common Controls v6,
    // `tauri::test` calls fail with STATUS_ENTRYPOINT_NOT_FOUND.
    //
    // This workaround:
    // 1. Embeds the manifest into test binaries via /MANIFEST:EMBED
    // 2. Uses /MANIFEST:NO for the main binary to avoid duplicate resources
    //    (Tauri already handles manifest embedding for the app binary)
    #[cfg(target_os = "windows")]
    {
        let manifest_path = std::path::PathBuf::from(
            std::env::var("CARGO_MANIFEST_DIR").expect("missing CARGO_MANIFEST_DIR"),
        )
        .join("common-controls.manifest");
        let manifest_arg = format!("/MANIFESTINPUT:{}", manifest_path.display());

        println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
        println!("cargo:rustc-link-arg={}", manifest_arg);
        // Avoid duplicate manifest resources in binary builds.
        println!("cargo:rustc-link-arg-bins=/MANIFEST:NO");
        println!("cargo:rerun-if-changed={}", manifest_path.display());
    }
}

fn build_macos_widget_bridge() {
    use std::path::PathBuf;
    use std::process::Command;

    let manifest_dir =
        PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").expect("missing CARGO_MANIFEST_DIR"));
    let source = manifest_dir
        .join("macos-widget")
        .join("HRouterWidgetBridge.swift");
    let output = PathBuf::from(std::env::var("OUT_DIR").expect("missing OUT_DIR"))
        .join("HRouterWidgetBridge.o");
    let cargo_target = std::env::var("TARGET").expect("missing TARGET");
    let swift_target = if cargo_target.starts_with("aarch64-") {
        "arm64-apple-macos12.0"
    } else if cargo_target.starts_with("x86_64-") {
        "x86_64-apple-macos12.0"
    } else {
        panic!("unsupported macOS target for WidgetKit bridge: {cargo_target}");
    };
    let sdk_output = Command::new("xcrun")
        .args(["--sdk", "macosx", "--show-sdk-path"])
        .output()
        .expect("failed to locate the macOS SDK");
    assert!(
        sdk_output.status.success(),
        "xcrun could not locate macOS SDK"
    );
    let sdk_path = String::from_utf8(sdk_output.stdout)
        .expect("macOS SDK path was not UTF-8")
        .trim()
        .to_string();
    let swiftc_output = Command::new("xcrun")
        .args(["--find", "swiftc"])
        .output()
        .expect("failed to locate swiftc");
    assert!(
        swiftc_output.status.success(),
        "xcrun could not locate swiftc"
    );
    let swiftc_path = PathBuf::from(
        String::from_utf8(swiftc_output.stdout)
            .expect("swiftc path was not UTF-8")
            .trim(),
    );
    let status = Command::new(&swiftc_path)
        .args(["-parse-as-library", "-emit-object"])
        .arg("-sdk")
        .arg(sdk_path)
        .arg("-target")
        .arg(swift_target)
        .arg("-module-name")
        .arg("HRouterWidgetBridge")
        .arg(&source)
        .arg("-o")
        .arg(&output)
        .status()
        .expect("failed to compile the WidgetKit bridge");
    assert!(
        status.success(),
        "swiftc could not compile WidgetKit bridge"
    );

    let swift_runtime = swiftc_path
        .parent()
        .and_then(|path| path.parent())
        .expect("swiftc is not inside the Xcode toolchain")
        .join("lib")
        .join("swift")
        .join("macosx");
    println!("cargo:rustc-link-search=native={}", swift_runtime.display());
    println!("cargo:rustc-link-arg={}", output.display());
    println!("cargo:rustc-link-lib=framework=WidgetKit");
    println!("cargo:rerun-if-changed={}", source.display());
}
