# Disposable remote test registration

- VMID: `230` (verified unused on Finland Proxmox)
- VM name: `nostrborg-blossom-test`
- Source: `debian-13-template` (VMID `200`)
- Writer/session: `01a03c18` (this NostrBorg session)
- Private network: `vmbr1`, planned address `10.77.0.230/24`, gateway `10.77.0.1`
- Internal hostname: `nostrborg-blossom-test`
- Public hostname: **owner/ingress gate; not assigned yet**
- Public ports: **none until a dedicated HTTPS ingress rule exists; intended TCP/443 only**
- Current private service: Blossom server on `10.77.0.230:3000`, reachable through the private management path only
- Allocation: 1 vCPU, 1 GiB RAM, 16 GiB thin-provisioned disk
- Expiry/disposition: destroy VM and revoke any ingress/DNS after interoperability proof unless explicitly promoted
- Data boundary: synthetic encrypted fixtures only; no production data or shared credentials

The VM is created privately first. The official Blossom server is deployed as a systemd service with local storage and BUD-11 auth enabled. A private tunnel test passed authenticated synthetic upload, download byte equality, and signed delete cleanup. No public exposure or DNS mutation has been made.
