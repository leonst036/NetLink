$ErrorActionPreference = "Stop"

function Show-Error {
    param([string]$Message)
    Write-Host "Error: $Message" -ForegroundColor Red
    Exit 1
}

# Check requirements
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Show-Error "Docker is required but it's not installed or not in PATH."
}

try {
    $null = docker info 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Docker not running" }
} catch {
    Show-Error "Docker is not running or you do not have permission. Please start Docker and try again."
}

Write-Host "====================================="
Write-Host "      NetLink Node Installer         "
Write-Host "====================================="

$RELAY_URL = "${relayUrl}"
$DOCKER_RELAY_URL = $RELAY_URL

if ($DOCKER_RELAY_URL -match "localhost" -or $DOCKER_RELAY_URL -match "127\.0\.0\.1") {
    $DOCKER_RELAY_URL = $DOCKER_RELAY_URL -replace "localhost", "host.docker.internal" -replace "127\.0\.0\.1", "host.docker.internal"
}

$TARGET_ID = Read-Host "Enter Target ID (your server's unique name)"

if ([string]::IsNullOrWhiteSpace($TARGET_ID)) {
    Show-Error "Target ID cannot be empty."
}

Write-Host "Validating Target ID '$TARGET_ID' with Relay ($RELAY_URL)..."

try {
    [Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}
    $VALIDATION = Invoke-RestMethod -Uri "$RELAY_URL/api/validate-target?target=$TARGET_ID" -Method Get -ErrorAction Stop
} catch {
    Show-Error "Failed to connect to the relay server at $RELAY_URL. $_"
}

if ($VALIDATION.valid -eq $true) {
    $JWT_TOKEN = $VALIDATION.token
    if ([string]::IsNullOrEmpty($JWT_TOKEN)) {
        Show-Error "Failed to extract token from validation response."
    }
    Write-Host "Target ID is valid! Proceeding with Docker installation..." -ForegroundColor Green
} else {
    Show-Error "Target ID '$TARGET_ID' is already taken or invalid."
}

try {
    docker run -d --network host --add-host=host.docker.internal:host-gateway --name netlink-node -e "RELAY_URL=$DOCKER_RELAY_URL" -e "RELAY_TOKEN=$JWT_TOKEN" -v /var/run/docker.sock:/var/run/docker.sock leon036/netlink-node:latest
    if ($LASTEXITCODE -ne 0) { throw "Docker run failed." }
} catch {
    Show-Error "Failed to start the Docker container. $_"
}

Write-Host "Installation complete! Your node is connecting to NetLink." -ForegroundColor Green
