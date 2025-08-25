from dotenv import load_dotenv
from openai import OpenAI
import os

load_dotenv()

client = OpenAI()
audio_file= open(r"D:\GitHub\boto\paito\.venv\teste.wav", "rb")

transcription = client.audio.transcriptions.create(
    model="gpt-4o-transcribe", 
    file=audio_file
)

print(transcription.text)