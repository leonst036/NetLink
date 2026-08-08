// Test Application Local Server
console.log("Test Application local_server has been successfully started by NetLink sandbox!");

// Provide a simple function that could be called if this app had API endpoints
export function getTestStatus() {
    return {
        status: "Running",
        message: "Test app is active",
        timestamp: new Date().toISOString()
    };
}
