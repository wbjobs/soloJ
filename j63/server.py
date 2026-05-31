import uuid
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

app = FastAPI()

rooms: dict = {}
transfers: dict = {}


class OfferPayload(BaseModel):
    room_id: str
    sdp: dict


class AnswerPayload(BaseModel):
    room_id: str
    sdp: dict


class CandidatePayload(BaseModel):
    room_id: str
    candidate: dict
    role: str


class TransferRegisterPayload(BaseModel):
    transfer_id: str
    room_id: str
    file_name: str
    file_size: int
    file_hash: str = ""


class TransferProgressPayload(BaseModel):
    received_bytes: int


@app.post("/offer")
def post_offer(payload: OfferPayload):
    if payload.room_id not in rooms:
        rooms[payload.room_id] = {
            "offer": None,
            "answer": None,
            "sender_candidates": [],
            "receiver_candidates": [],
        }
    rooms[payload.room_id]["offer"] = payload.sdp
    return {"status": "ok"}


@app.get("/offer/{room_id}")
def get_offer(room_id: str):
    if room_id not in rooms or rooms[room_id]["offer"] is None:
        raise HTTPException(status_code=404, detail="Offer not found")
    return {"sdp": rooms[room_id]["offer"]}


@app.post("/answer")
def post_answer(payload: AnswerPayload):
    if payload.room_id not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    rooms[payload.room_id]["answer"] = payload.sdp
    return {"status": "ok"}


@app.get("/answer/{room_id}")
def get_answer(room_id: str):
    if room_id not in rooms or rooms[room_id]["answer"] is None:
        raise HTTPException(status_code=404, detail="Answer not found")
    return {"sdp": rooms[room_id]["answer"]}


@app.post("/candidate")
def post_candidate(payload: CandidatePayload):
    if payload.room_id not in rooms:
        rooms[payload.room_id] = {
            "offer": None,
            "answer": None,
            "sender_candidates": [],
            "receiver_candidates": [],
        }
    if payload.role == "sender":
        rooms[payload.room_id]["sender_candidates"].append(payload.candidate)
    else:
        rooms[payload.room_id]["receiver_candidates"].append(payload.candidate)
    return {"status": "ok"}


@app.get("/candidate/{room_id}/{role}")
def get_candidates(room_id: str, role: str):
    if room_id not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    if role == "sender":
        return {"candidates": rooms[room_id]["sender_candidates"]}
    elif role == "receiver":
        return {"candidates": rooms[room_id]["receiver_candidates"]}
    else:
        raise HTTPException(status_code=400, detail="Invalid role")


@app.post("/transfer")
def register_transfer(payload: TransferRegisterPayload):
    if payload.transfer_id not in transfers:
        transfers[payload.transfer_id] = {
            "transfer_id": payload.transfer_id,
            "room_id": payload.room_id,
            "file_name": payload.file_name,
            "file_size": payload.file_size,
            "file_hash": payload.file_hash,
            "received_bytes": 0,
        }
    return {"status": "ok"}


@app.get("/transfer/{transfer_id}")
def get_transfer(transfer_id: str):
    if transfer_id not in transfers:
        raise HTTPException(status_code=404, detail="Transfer not found")
    return transfers[transfer_id]


@app.post("/transfer/{transfer_id}/progress")
def update_progress(transfer_id: str, payload: TransferProgressPayload):
    if transfer_id not in transfers:
        raise HTTPException(status_code=404, detail="Transfer not found")
    if payload.received_bytes > transfers[transfer_id]["received_bytes"]:
        transfers[transfer_id]["received_bytes"] = payload.received_bytes
    return {"status": "ok"}


@app.delete("/transfer/{transfer_id}")
def delete_transfer(transfer_id: str):
    if transfer_id in transfers:
        del transfers[transfer_id]
    return {"status": "ok"}


@app.get("/room/new")
def new_room():
    room_id = str(uuid.uuid4())[:8]
    rooms[room_id] = {
        "offer": None,
        "answer": None,
        "sender_candidates": [],
        "receiver_candidates": [],
    }
    return {"room_id": room_id}


app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
def index():
    return FileResponse("static/index.html")
