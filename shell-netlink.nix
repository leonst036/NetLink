{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  name = "netlink-development-environment";

  buildInputs = [
    pkgs.python3
    pkgs.nodejs_22
    pkgs.openssl
    pkgs.net-tools
  ];

  shellHook = ''
    echo "================================================="
    echo " Welcome to your Netlink Development Environment"
    echo "================================================="
    echo "Available versions:"
    echo "  - Python: $(python3 --version)"
    echo "  - Node.js: $(node --version)"
    echo "  - NPM: $(npm --version)"
    echo "  - Arp: $(arp --version)"
    echo "================================================="
  '';
}
