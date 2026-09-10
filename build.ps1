# 一键构建脚本（Windows PowerShell）
# 用法：右键“使用 PowerShell 运行”，或在终端执行 .\build.ps1
# 说明：本项目在无管理员权限环境下使用 GNU 工具链构建，依赖：
#   - Rust stable-x86_64-pc-windows-gnu（rustup 安装）
#   - MinGW-w64（便携版，位于下方 $MinGW 路径）
#   - WebView2 运行时（Windows 11 内置；Windows 10 需单独安装）

$ErrorActionPreference = 'Stop'

# 如 MinGW 安装在其他位置，请修改此处
$MinGW = 'D:\ascvd\.tools\mingw\mingw64'

if (-not (Test-Path "$MinGW\bin\x86_64-w64-mingw32-gcc.exe")) {
  Write-Host "未找到 MinGW（$MinGW），请修改脚本中的 `$MinGW 路径。" -ForegroundColor Red
  exit 1
}

$env:Path = "$MinGW\bin;$env:USERPROFILE\.cargo\bin;$env:Path"
# 绕过本机系统代理，避免打包工具下载时 TLS 证书校验失败
$env:HTTP_PROXY = ''; $env:HTTPS_PROXY = ''; $env:ALL_PROXY = ''
$env:http_proxy = ''; $env:https_proxy = ''; $env:all_proxy = ''
$env:NO_PROXY = '*'; $env:no_proxy = '*'

# 本地仅构建 NSIS 安装包（跨平台目标在 GitHub Actions 中按系统构建）
npm run tauri build -- --bundles nsis
