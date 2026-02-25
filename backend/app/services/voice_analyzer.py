"""
Voice biometric verification using OpenAI Whisper (transcription) + GPT-4o (analysis).

Flow:
1. Applicant records themselves reading a passphrase
2. Whisper transcribes the audio
3. GPT-4o compares transcription to expected passphrase and assesses voice characteristics
"""

import os
import json
from pathlib import Path
from openai import OpenAI, BadRequestError

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))

PASSPHRASE_TEMPLATE = "My name is {first_name} {last_name} and I am verifying my identity"

VOICE_ANALYSIS_PROMPT = """You are a voice biometric analyst for a KYC (Know Your Customer) system.

An applicant was asked to read the following passphrase aloud:
"{expected_passphrase}"

The speech-to-text transcription of their recording is:
"{transcription}"

The applicant claims to be: {first_name} {last_name}

Analyze the voice verification and return ONLY a valid JSON object:

{{
  "passphrase_match": true/false,
  "passphrase_similarity": 0.0-1.0,
  "transcription": "the exact transcription",
  "expected_passphrase": "what they were asked to say",
  "spoken_name": "the name spoken in the recording (or null if unclear)",
  "name_matches_claim": true/false,
  "audio_quality": "good|fair|poor",
  "confidence": 0.0-1.0,
  "language_detected": "language code",
  "anomalies": [
    {{
      "type": "mismatch|unclear_speech|background_noise|suspicious_pattern|name_discrepancy",
      "severity": "critical|warning|info",
      "description": "explanation"
    }}
  ],
  "verification_result": "pass|fail|inconclusive",
  "explanation": "Summary of voice verification findings"
}}

## Analysis Guidelines
- passphrase_match: true if the transcription closely matches the expected passphrase (allow minor variations)
- passphrase_similarity: how closely the spoken words match (1.0 = exact, 0.0 = completely different)
- name_matches_claim: does the name spoken match the claimed identity?
- Flag if: wrong name spoken, pre-recorded/robotic patterns, significant deviations from passphrase
- verification_result: "pass" if passphrase matches and name is correct, "fail" if clear mismatch, "inconclusive" if audio quality prevents determination

Return ONLY the JSON object."""


VOICE_COMPARE_PROMPT = """You are a voice biometric analyst. You have two transcriptions from two separate voice recordings.
Both recordings were supposed to be the same person reading the same passphrase.

**Enrollment recording** (baseline, recorded during initial identity verification):
"{enrollment_transcription}"

**New recording** (just recorded now, for re-verification):
"{new_transcription}"

**Expected passphrase:** "{expected_passphrase}"
**Claimed identity:** {first_name} {last_name}

Analyze whether these two recordings are likely from the SAME person and return ONLY a valid JSON object:

{{
  "same_speaker_likelihood": 0.0-1.0,
  "match_result": "match|mismatch|inconclusive",
  "enrollment_transcription": "...",
  "new_transcription": "...",
  "passphrase_consistency": 0.0-1.0,
  "name_spoken_in_new": "name spoken in the new recording (or null)",
  "speech_pattern_notes": "observations about speech patterns, phrasing, accent indicators",
  "anomalies": [
    {{
      "type": "different_speaker|different_name|suspicious_pattern|quality_issue|text_to_speech",
      "severity": "critical|warning|info",
      "description": "explanation"
    }}
  ],
  "confidence": 0.0-1.0,
  "explanation": "Summary — are these likely the same person?"
}}

## Guidelines
- Compare speech patterns, phrasing style, and consistency between both recordings
- same_speaker_likelihood: 1.0 = almost certainly same person, 0.0 = almost certainly different
- "match" if same_speaker_likelihood > 0.6
- "mismatch" if same_speaker_likelihood < 0.3 or name is clearly different
- "inconclusive" if quality prevents determination
- Flag if the new recording sounds like text-to-speech or a replay

Return ONLY the JSON object."""


def get_expected_passphrase(first_name: str, last_name: str) -> str:
    return PASSPHRASE_TEMPLATE.format(first_name=first_name, last_name=last_name)


def _voice_error_response(expected: str, reason: str, transcription: str = "") -> dict:
    """Structured error result when voice processing fails."""
    return {
        "passphrase_match": False,
        "passphrase_similarity": 0.0,
        "transcription": transcription,
        "expected_passphrase": expected,
        "spoken_name": None,
        "name_matches_claim": False,
        "audio_quality": "poor",
        "confidence": 0.0,
        "language_detected": "unknown",
        "anomalies": [{"type": "processing_error", "severity": "critical", "description": reason}],
        "verification_result": "fail",
        "explanation": reason,
    }


def analyze_voice(
    audio_path: str,
    first_name: str,
    last_name: str,
) -> dict:
    """Transcribe audio with Whisper, then analyze with GPT-4o."""
    path = Path(audio_path)
    if not path.exists():
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    expected = get_expected_passphrase(first_name, last_name)

    try:
        with open(path, "rb") as f:
            transcript_response = client.audio.transcriptions.create(
                model="whisper-1",
                file=f,
                response_format="text",
            )
    except BadRequestError as e:
        return _voice_error_response(expected, f"Audio file rejected by transcription service: {e}")
    except Exception as e:
        return _voice_error_response(expected, f"Failed to transcribe audio: {e}")

    transcription = transcript_response.strip() if isinstance(transcript_response, str) else str(transcript_response).strip()

    if not transcription:
        return _voice_error_response(expected, "No speech could be detected in the submitted voice sample.")

    prompt = VOICE_ANALYSIS_PROMPT.format(
        expected_passphrase=expected,
        transcription=transcription,
        first_name=first_name,
        last_name=last_name,
    )

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1000,
            temperature=0.1,
            timeout=20,
        )

        content = (response.choices[0].message.content or "").strip()
        if not content:
            return _voice_error_response(expected, "Empty response from voice analysis", transcription=transcription)

        if content.startswith("```"):
            content = content.split("\n", 1)[1]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

        result = json.loads(content)
    except BadRequestError as e:
        return _voice_error_response(expected, f"Voice analysis request rejected: {e}", transcription=transcription)
    except (json.JSONDecodeError, ValueError, AttributeError) as e:
        return _voice_error_response(expected, f"Failed to parse voice analysis response: {e}", transcription=transcription)

    result["transcription"] = transcription
    result["expected_passphrase"] = expected

    return result


def _transcribe(audio_path: str) -> str:
    """Transcribe an audio file. Returns empty string on any failure."""
    try:
        with open(audio_path, "rb") as f:
            resp = client.audio.transcriptions.create(
                model="whisper-1",
                file=f,
                response_format="text",
            )
        return resp.strip() if isinstance(resp, str) else str(resp).strip()
    except Exception:
        return ""


def compare_voices(
    enrollment_audio_path: str,
    new_audio_path: str,
    first_name: str,
    last_name: str,
) -> dict:
    """Compare an enrollment voice sample with a new recording."""
    enrollment_text = _transcribe(enrollment_audio_path)
    new_text = _transcribe(new_audio_path)

    if not enrollment_text:
        return {
            "same_speaker_likelihood": 0.0,
            "match_result": "inconclusive",
            "enrollment_transcription": "",
            "new_transcription": new_text,
            "confidence": 0.0,
            "anomalies": [{"type": "quality_issue", "severity": "critical", "description": "Enrollment recording has no detectable speech."}],
            "explanation": "Cannot compare — original enrollment recording is empty.",
        }
    if not new_text:
        return {
            "same_speaker_likelihood": 0.0,
            "match_result": "inconclusive",
            "enrollment_transcription": enrollment_text,
            "new_transcription": "",
            "confidence": 0.0,
            "anomalies": [{"type": "quality_issue", "severity": "critical", "description": "New recording has no detectable speech."}],
            "explanation": "Cannot compare — new recording is empty.",
        }

    expected = get_expected_passphrase(first_name, last_name)
    prompt = VOICE_COMPARE_PROMPT.format(
        enrollment_transcription=enrollment_text,
        new_transcription=new_text,
        expected_passphrase=expected,
        first_name=first_name,
        last_name=last_name,
    )

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1000,
            temperature=0.1,
            timeout=20,
        )

        content = (response.choices[0].message.content or "").strip()
        if not content:
            return {
                "same_speaker_likelihood": 0.0,
                "match_result": "error",
                "enrollment_transcription": enrollment_text,
                "new_transcription": new_text,
                "confidence": 0.0,
                "anomalies": [{"type": "processing_error", "severity": "critical", "description": "Empty response from voice comparison service"}],
                "explanation": "Voice comparison failed — empty AI response.",
            }

        if content.startswith("```"):
            content = content.split("\n", 1)[1]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

        result = json.loads(content)
    except (BadRequestError, json.JSONDecodeError, ValueError, AttributeError) as e:
        return {
            "same_speaker_likelihood": 0.0,
            "match_result": "error",
            "enrollment_transcription": enrollment_text,
            "new_transcription": new_text,
            "confidence": 0.0,
            "anomalies": [{"type": "processing_error", "severity": "critical", "description": f"Voice comparison failed: {e}"}],
            "explanation": f"Voice comparison could not be completed: {e}",
        }

    result["enrollment_transcription"] = enrollment_text
    result["new_transcription"] = new_text
    return result
