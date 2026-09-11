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

## Shared Finland ingress registration

- VMID: `211` (verified unused)
- VM name: `ingress`
- Source: `debian-13-template` (VMID `200`)
- Owner: shared Finland HTTPS ingress infrastructure; this session is the sole bootstrap writer
- Private network: `vmbr1`, planned address `10.77.0.211/24`, gateway `10.77.0.1`
- Allocation: 1 vCPU, 512 MiB RAM initially, 16 GiB thin-provisioned disk
- Proxy: Caddy only; no application workloads (installed, route not configured)
- Allowed backend: `10.77.0.230:3000` only for the temporary Blossom route
- Public ports: intended TCP/443 only; TCP/80 only if certificate issuance requires it
- Public hostname: **owner/project DNS gate; not assigned yet**
- Current exposure: none; Proxmox has no TCP/443 or TCP/80 forwarding rule
- External public IP for DNS A record: `95.216.36.49` (Finland Proxmox public interface)
- Expiry/disposition: preserve VM 211 as shared ingress; remove only the temporary NostrBorg route after testing

The VM is created privately first. The official Blossom server is deployed as a systemd service with local storage and BUD-11 auth enabled. A private tunnel test passed authenticated synthetic upload, download byte equality, and signed delete cleanup. The public test then passed over HTTPS through ingress: BUD-06 preflight, BUD-11 upload auth, BUD-01 download byte equality, and BUD-02 signed delete/404. No public Nostr relay was used. Ingress Caddy measured approximately 43 MiB RSS at idle; Blossom used approximately 150 MiB across its Deno processes. The disposable backend and route are now scheduled for teardown; shared ingress VM 211 is retained.
