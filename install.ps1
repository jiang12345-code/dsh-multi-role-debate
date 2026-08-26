# dsh-multi-role-debate 一键安装（Windows PowerShell）
# 用法：pwsh install.ps1 [-Profile web] [--uninstall]
# 作用：把 dsh-codex-agent / dsh-claude-agent / multi-role-debate / dsh-multi-role-debate 复制进
#       目标 DSH profile 的 node_modules，并把 profiles 的 dsh.profile.bundles 里的 3 个单独条目
#       换成聚合包 dsh-multi-role-debate。
param(
  [string]$Profile = "web",
  [switch]$Uninstall
)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
$profilesRoot = if ($env:DSH_HOME) { Join-Path $env:DSH_HOME "profiles" } else { Join-Path $HOME ".dsh\profiles" }
$prof = Join-Path $profilesRoot $Profile
$nm = Join-Path $prof "node_modules"
$pkgJson = Join-Path $prof "package.json"

if ($Uninstall) {
  Write-Host "[uninstall] 从 bundles 移除聚合包并恢复 3 个组件条目..."
  if (-not (Test-Path $pkgJson)) { Write-Host "  profile package.json 不存在: $pkgJson"; exit 0 }
  $j = Get-Content $pkgJson -Raw | ConvertFrom-Json
  $b = @($j.dsh.profile.bundles) -ne "dsh-multi-role-debate"
  $b = @($b + @("dsh-codex-agent","dsh-claude-agent","multi-role-debate"))
  $j.dsh.profile.bundles = $b
  $j | ConvertTo-Json -Depth 10 | Set-Content $pkgJson -Encoding utf8
  Write-Host "  已更新 bundles。请重启 DSH。"
  exit 0
}

if (-not (Test-Path $prof)) {
  Write-Host "[error] profile 目录不存在: $prof`n  请先创建 profile（例如 dsh --profile $Profile 或手工初始化）。"
  exit 1
}
if (-not (Test-Path $nm)) { New-Item -ItemType Directory -Path $nm -Force | Out-Null }

# 复制 4 个包
$pkgs = @("dsh-codex-agent","dsh-claude-agent","multi-role-debate","dsh-multi-role-debate")
foreach ($p in $pkgs) {
  $src = Join-Path $repo $p
  if (-not (Test-Path $src)) { Write-Host "[error] 找不到包: $src"; exit 1 }
  $dst = Join-Path $nm $p
  if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
  Copy-Item $src $dst -Recurse -Force
  Write-Host "  installed: $p"
}

# 编辑 bundles：去掉 3 个单独条目，加聚合包
$j = Get-Content $pkgJson -Raw | ConvertFrom-Json
$b = @($j.dsh.profile.bundles) | Where-Object { $_ -notin @("dsh-codex-agent","dsh-claude-agent","multi-role-debate") }
# 已带聚合包则去重
$b = @($b) | Where-Object { $_ -ne "dsh-multi-role-debate" }
# 加在 dsh-mnemon 之前（若无则追加）
$b = @($b + @("dsh-multi-role-debate"))
$j.dsh.profile.bundles = $b
$j | ConvertTo-Json -Depth 10 | Set-Content $pkgJson -Encoding utf8

Write-Host ""
Write-Host "[done] 已安装 dsh-multi-role-debate 聚合包到 profile '$Profile'。"
Write-Host "  请编辑 $pkgJson 的 dsh.profile.bundles 调整顺序（聚合包应在 dsh-codex-agent 等被插入后生效前的位置即可），然后重启 DSH。"
Write-Host "  前置依赖：本机需已装 Codex CLI 与 Claude Agent SDK。"
