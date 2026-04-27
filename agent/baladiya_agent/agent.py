from google.adk.agents import LlmAgent

from .prompts import SYSTEM_INSTRUCTION
from .tools import create_ticket

root_agent = LlmAgent(
    name="baladiya_reporter",
    model="gemini-2.5-flash",
    description=(
        "Civic-issue reporting agent for Qatar Baladiya. Analyzes a user-submitted "
        "photo, asks brief clarifying questions in the user's language, then files a "
        "routed ticket for potholes/road damage or fallen tree hazards."
    ),
    instruction=SYSTEM_INSTRUCTION,
    tools=[create_ticket],
)
