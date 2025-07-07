## Local Testing Limitation: Microphone Access

When testing two users (A and B) locally on the same machine, especially in the same browser (even in different tabs or windows), you may encounter the following limitation:

- **Browsers only allow one tab or context to access the microphone at a time.**
- If both A and B are running in the same browser, only one can have an active microphone stream. The other may receive silence, a dummy stream, or be denied access entirely.
- As a result, you may see transcription working for only one user (A or B), but not both.

**How to avoid this issue:**
- Use two different browsers (e.g., Chrome and Firefox) on the same machine, or
- Use two separate devices (e.g., a laptop and a phone).

This limitation is due to browser security and hardware constraints, not your application code. Always check browser console logs for microphone permission errors if you encounter this issue. 