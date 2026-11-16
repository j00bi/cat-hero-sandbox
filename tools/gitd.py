#!/usr/bin/env python3
"""Minimal token-gated git smart-HTTP server (one bare repo, basic auth)."""
import base64, os, shutil, subprocess, sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.environ.get("GITD_ROOT") or os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.join(ROOT)
USER, PASS = open(os.path.join(ROOT, "passwd")).read().strip().split(":", 1)
PORT = int(os.environ.get("GITD_PORT", "8899"))
BACKEND = "/usr/lib/git-core/git-http-backend"

def auth_ok(header):
    if not header or not header.startswith("Basic "):
        return False
    try:
        u, p = base64.b64decode(header[6:]).decode().split(":", 1)
    except Exception:
        return False
    return u == USER and p == PASS

class H(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "gitd"

    def log_message(self, *a):
        sys.stderr.write("%s %s\n" % (self.address_string(), a[0] % a[1:]))

    def _deny(self):
        body = b"auth required\n"
        self.send_response(401)
        self.send_header("WWW-Authenticate", 'Basic realm="cat-hero agent repo"')
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _run(self, method):
        if not auth_ok(self.headers.get("Authorization")):
            return self._deny()

        path = self.path.split("?", 1)
        path_info = path[0]
        query = path[1] if len(path) > 1 else ""

        if ".." in path_info:
            return self._deny()

        env = {
            "GIT_PROJECT_ROOT": REPO_ROOT,
            "GIT_HTTP_EXPORT_ALL": "1",
            "PATH_INFO": path_info,
            "QUERY_STRING": query,
            "REQUEST_METHOD": method,
            "REMOTE_USER": USER,
            "REMOTE_ADDR": self.address_string(),
            "GATEWAY_INTERFACE": "CGI/1.1",
            "SERVER_PROTOCOL": "HTTP/1.1",
            "GIT_HTTP_MAX_REQUEST_BUFFER": "100M",
        }
        body = b""
        if method == "POST":
            n = int(self.headers.get("Content-Length") or 0)
            body = self.rfile.read(n) if n else b""
            env["CONTENT_TYPE"] = self.headers.get("Content-Type", "")
            env["CONTENT_LENGTH"] = str(n)
        if self.headers.get("Content-Encoding"):
            env["HTTP_CONTENT_ENCODING"] = self.headers["Content-Encoding"]
        if self.headers.get("Git-Protocol"):
            env["GIT_PROTOCOL"] = self.headers["Git-Protocol"]

        proc = subprocess.run([BACKEND], input=body, env=env,
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        out = proc.stdout
        head, _, payload = out.partition(b"\r\n\r\n")
        if not _:
            head, _, payload = out.partition(b"\n\n")
        status, headers = 200, []
        for line in head.decode(errors="replace").splitlines():
            if line.lower().startswith("status:"):
                status = int(line.split(":", 1)[1].strip().split()[0])
            elif ":" in line:
                headers.append(line.split(":", 1))

        self.send_response(status)
        for k, v in headers:
            self.send_header(k.strip(), v.strip())
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)
        if proc.stderr:
            sys.stderr.write(proc.stderr.decode(errors="replace")[:400])

    def do_GET(self):
        if self.path in ("/", "/health.txt", "/health"):
            body = (b"CAT HERO agent git endpoint: OK\n\n"
                    b"git clone https://<user>:<token>@HOST/cat-hero.git\n")
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self._run("GET")

    def do_POST(self):
        self._run("POST")

if __name__ == "__main__":
    print(f"gitd on 127.0.0.1:{PORT} root={REPO_ROOT}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
