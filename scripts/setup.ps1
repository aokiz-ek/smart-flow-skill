# Ethan Setup Script for Windows PowerShell
# Usage: iwr -useb https://raw.githubusercontent.com/your-repo/main/scripts/setup.ps1 | iex
# Or:    .\scripts\setup.ps1

$ErrorActionPreference = 'Stop'

# Set UTF-8 encoding for correct output
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "   Ethan - AI Workflow Assistant Setup (Windows)     " -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# ─── Check Node.js ──────────────────────────────────────────────────────────
Write-Host "[1/5] Checking Node.js..." -ForegroundColor Yellow

try {
    $nodeVersion = node --version 2>&1
    $major = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    if ($major -lt 18) {
        Write-Host "  ERROR: Node.js $nodeVersion found, but >= 18 required." -ForegroundColor Red
        Write-Host "  Download: https://nodejs.org/en/download" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "  OK: Node.js $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Node.js not found. Please install Node.js >= 18." -ForegroundColor Red
    Write-Host "  Download: https://nodejs.org/en/download" -ForegroundColor Yellow
    exit 1
}

# ─── Check npm ──────────────────────────────────────────────────────────────
Write-Host "[2/5] Checking npm..." -ForegroundColor Yellow

try {
    $npmVersion = npm --version 2>&1
    Write-Host "  OK: npm $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: npm not found. Reinstall Node.js." -ForegroundColor Red
    exit 1
}

# ─── Install Ethan ──────────────────────────────────────────────────────────
Write-Host "[3/5] Installing smart-flow-skill..." -ForegroundColor Yellow

# Fix common PowerShell npm issues:
# 1. Set npm prefix to avoid permission errors
# 2. Use --no-fund --no-audit for cleaner output
try {
    $npmGlobalPath = npm config get prefix 2>&1
    Write-Host "  npm global: $npmGlobalPath" -ForegroundColor Gray

    # Check if global npm bin is in PATH
    $globalBin = Join-Path $npmGlobalPath "bin"
    if ($env:OS -eq "Windows_NT") {
        $globalBin = $npmGlobalPath  # On Windows, prefix IS the bin directory
    }

    npm install -g smart-flow-skill --no-fund --no-audit 2>&1 | ForEach-Object {
        if ($_ -match "error|ERR!" -and $_ -notmatch "npm warn") {
            Write-Host "  ! $_" -ForegroundColor Red
        } elseif ($_ -match "added|updated") {
            Write-Host "  $_ " -ForegroundColor Green
        }
    }

    Write-Host "  OK: smart-flow-skill installed" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Installation failed: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Try these fixes:" -ForegroundColor Yellow
    Write-Host "  1. Run PowerShell as Administrator" -ForegroundColor Yellow
    Write-Host "  2. Set execution policy: Set-ExecutionPolicy RemoteSigned -Scope CurrentUser" -ForegroundColor Yellow
    Write-Host "  3. Use nvm for Windows: https://github.com/coreybutler/nvm-windows" -ForegroundColor Yellow
    exit 1
}

# ─── Verify Installation ─────────────────────────────────────────────────────
Write-Host "[4/5] Verifying installation..." -ForegroundColor Yellow

try {
    $ethanVersion = ethan --version 2>&1
    Write-Host "  OK: ethan $ethanVersion" -ForegroundColor Green
} catch {
    # Try refreshing PATH
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("PATH", "User")
    try {
        $ethanVersion = ethan --version 2>&1
        Write-Host "  OK: ethan $ethanVersion (PATH refreshed)" -ForegroundColor Green
    } catch {
        Write-Host "  WARN: ethan command not found in PATH yet." -ForegroundColor Yellow
        Write-Host "  Restart PowerShell and run 'ethan --version' to verify." -ForegroundColor Yellow
    }
}

# ─── Quick Setup ─────────────────────────────────────────────────────────────
Write-Host "[5/5] Quick setup..." -ForegroundColor Yellow

$runSetup = Read-Host "  Run interactive setup wizard? [Y/n]"
if ($runSetup -ne 'n' -and $runSetup -ne 'N') {
    try {
        ethan setup
    } catch {
        Write-Host "  Restart PowerShell and run 'ethan setup'" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  Setup complete! Get started:" -ForegroundColor Green
Write-Host ""
Write-Host "  ethan list              # List all skills" -ForegroundColor White
Write-Host "  ethan setup             # Interactive setup wizard" -ForegroundColor White
Write-Host "  ethan slash --platform cursor   # Generate editor commands" -ForegroundColor White
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""
