import asyncio
import json
from typing import Set

class SSEBroadcaster:
    def __init__(self):
        self.clients: Set[asyncio.Queue] = set()

    async def subscribe(self) -> asyncio.Queue:
        q = asyncio.Queue()
        self.clients.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue):
        self.clients.discard(q)

    async def broadcast(self, event_name: str, payload: dict):
        msg = f"event: {event_name}\ndata: {json.dumps(payload)}\n\n"
        for q in list(self.clients):
            try:
                await q.put(msg)
            except Exception:
                self.clients.discard(q)

sse_hub = SSEBroadcaster()