import os
import resend
from typing import List, Dict

def send_saved_opportunities_email(to_email: str, opportunities: List[Dict]):
    """
    Sends an email containing the saved opportunities using Resend.
    """
    resend.api_key = os.environ.get("RESEND_API_KEY")
    
    if not resend.api_key:
        print("RESEND_API_KEY not found. Email not sent.")
        return False
        
    if not opportunities:
        print("No opportunities to send.")
        return False

    # Format the email body
    html_content = f"""
    <div style="font-family: sans-serif; max-w-2xl; margin: 0 auto; padding: 20px;">
        <h1 style="color: #2563eb;">1waygo - Your Saved Opportunities</h1>
        <p>Here are the AI-curated opportunities you saved:</p>
        <hr style="border: 1px solid #e5e7eb; margin: 20px 0;">
    """
    
    for opp in opportunities:
        html_content += f"""
        <div style="margin-bottom: 25px; padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h2 style="margin-top: 0; color: #1e293b;">{opp.get('title')}</h2>
            <p><strong>Company/Host:</strong> {opp.get('company')}</p>
            <p><strong>Type:</strong> {opp.get('type')}</p>
            <p><strong>Deadline:</strong> {opp.get('deadline')}</p>
            <p><strong>Why it's a match:</strong> <em>{opp.get('reason')}</em></p>
            <p>{opp.get('description')}</p>
            <a href="{opp.get('url')}" style="display: inline-block; background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px;">Apply Now</a>
        </div>
        """
        
    html_content += """
        <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
            Sent by 1waygo - Your AI Career Finder
        </p>
    </div>
    """

    try:
        # Send the email
        params = {
            "from": "1waygo <onboarding@resend.dev>",
            "to": [to_email],
            "subject": "Your Saved Opportunities - 1waygo",
            "html": html_content,
        }
        
        email_response = resend.Emails.send(params)
        print(f"Email sent successfully: {email_response}")
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False
