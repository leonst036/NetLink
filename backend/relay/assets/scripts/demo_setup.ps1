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
Write-Host "   NetLink Demo Node Installer       "
Write-Host "====================================="

$RELAY_URL = "${relayUrl}"
$DOCKER_RELAY_URL = $RELAY_URL

if ($DOCKER_RELAY_URL -match "localhost" -or $DOCKER_RELAY_URL -match "127\.0\.0\.1") {
    $DOCKER_RELAY_URL = $DOCKER_RELAY_URL -replace "localhost", "host.docker.internal" -replace "127\.0\.0\.1", "host.docker.internal"
}

Write-Host "Setting up temporary demo user..."

try {
    [Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}
    $RESPONSE = Invoke-RestMethod -Uri "$RELAY_URL/api/demo-setup" -Method Post -ErrorAction Stop
} catch {
    Show-Error "Failed to connect to the relay server at $RELAY_URL. $_"
}

$USERNAME = $RESPONSE.username
$PASSWORD = $RESPONSE.password
$TARGET_ID = $RESPONSE.targetId
$JWT_TOKEN = $RESPONSE.jwtToken

if ([string]::IsNullOrEmpty($USERNAME) -or [string]::IsNullOrEmpty($PASSWORD) -or [string]::IsNullOrEmpty($TARGET_ID) -or [string]::IsNullOrEmpty($JWT_TOKEN)) {
    Show-Error "Failed to create demo user on the relay server. Invalid response."
}

Write-Host "Success! Created temporary demo user." -ForegroundColor Green
Write-Host "Starting NetLink Node in Docker (Will automatically destruct after 24h)..."

try {
    docker run -d --rm --network host --add-host=host.docker.internal:host-gateway --name "netlink-demo-$TARGET_ID" -e "RELAY_URL=$DOCKER_RELAY_URL" -e "RELAY_TOKEN=$JWT_TOKEN" -e "DEMO_TIMEOUT=86400" leon036/netlink-node:latest
    if ($LASTEXITCODE -ne 0) { throw "Docker run failed." }
} catch {
    Show-Error "Failed to start the Docker container. $_"
}

Write-Host ""
Write-Host "====================================="
Write-Host "DEMO READY!" -ForegroundColor Cyan
Write-Host "====================================="
Write-Host "URL:      $RELAY_URL"
Write-Host "Username: $USERNAME"
Write-Host "Password: $PASSWORD"
Write-Host "====================================="
Write-Host "Login to the URL above to manage your machine!"
Write-Host "Note: The demo user and this node will expire automatically after 24 hours."
Write-Host "To stop early, run: docker stop netlink-demo-$TARGET_ID"
