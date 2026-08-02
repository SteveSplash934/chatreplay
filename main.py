import re
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.concurrency import run_in_threadpool
import uvicorn

app = FastAPI(title="WhatsApp Chat Replayer")
app.mount("/static", StaticFiles(directory="static"), name="static")

def parse_chat_content(content: str) -> dict:
    messages = []
    participants = set()
    
    # Regex for [DD/MM/YYYY, HH:MM:SS] or [DD/MM/YY, H:MM:SS PM]
    pattern = re.compile(r'^\[(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}),\s+(\d{1,2}:\d{2}:\d{2}(?:[\s\u202F]*[a-zA-Z]{2})?)\]\s+(.*)')
    
    system_triggers = [
        "Messages and calls are end-to-end encrypted",
        "You use a default timer",
        "You updated the message timer",
        "turned off disappearing messages",
        "turned on disappearing messages",
        "security code changed"
    ]
    
    edit_marker = "<This message was edited>"
    
    lines = content.splitlines()
    
    for line in lines:
        line = line.replace('\u200E', '').replace('\u200F', '').replace('\u202A', '').replace('\u202C', '').strip()
        if not line:
            continue
            
        match = pattern.match(line)
        if match:
            date_str, time_str, text_content = match.groups()
            
            if ': ' in text_content:
                sender, msg_text = text_content.split(': ', 1)
                
                is_system = False
                
                if len(sender) > 50 or sender == 'WhatsApp':
                    is_system = True
                    display_text = text_content
                else:
                    for trigger in system_triggers:
                        if trigger in msg_text:
                            is_system = True
                            display_text = msg_text
                            break
                
                if is_system:
                    messages.append({'type': 'system', 'date': date_str, 'time': time_str, 'text': display_text})
                else:
                    is_edited = False
                    if edit_marker in msg_text:
                        msg_text = msg_text.replace(edit_marker, '').strip()
                        is_edited = True
                        
                    participants.add(sender)
                    messages.append({
                        'type': 'message', 
                        'date': date_str, 
                        'time': time_str, 
                        'sender': sender, 
                        'text': msg_text,
                        'is_edited': is_edited
                    })
            else:
                messages.append({'type': 'system', 'date': date_str, 'time': time_str, 'text': text_content})
        else:
            if messages:
                messages[-1]['text'] += '\n' + line
                
                if messages[-1].get('type') == 'message' and edit_marker in messages[-1]['text']:
                    messages[-1]['text'] = messages[-1]['text'].replace(edit_marker, '').strip()
                    messages[-1]['is_edited'] = True
                
    return {
        "participants": list(participants),
        "messages": messages
    }

@app.get("/")
async def root():
    return RedirectResponse(url="/static/index.html")

@app.post("/api/upload")
async def upload_chat(filepond: UploadFile = File(...)):
    if not filepond.filename.endswith('.txt'):
        raise HTTPException(status_code=400, detail="Only .txt files are allowed")
    
    try:
        contents = await filepond.read()
        decoded_content = contents.decode('utf-8', errors='replace')
        parsed_data = await run_in_threadpool(parse_chat_content, decoded_content)
        return JSONResponse(content=parsed_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)