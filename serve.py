"""Host the slides on your network: run  python3 serve.py  in this folder, then open the address it prints.
Python's built-in server only queues 5 connections and drops the rest, which made photos go missing at random,
so this one queues more. Press Ctrl+C to stop."""
import http.server, os, socket, sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
os.chdir(os.path.dirname(os.path.abspath(__file__)))

class Server(http.server.ThreadingHTTPServer):
    request_queue_size = 128

def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        return s.getsockname()[0]
    except OSError:
        return '127.0.0.1'
    finally:
        s.close()

with Server(('0.0.0.0', PORT), http.server.SimpleHTTPRequestHandler) as httpd:
    print(f'Slides: http://{lan_ip()}:{PORT}/   (this computer: http://localhost:{PORT}/)', flush=True)
    print('Other decks: gazelles.html, tumbler-ridge.html. Ctrl+C to stop.', flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
