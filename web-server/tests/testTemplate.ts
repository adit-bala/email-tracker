// serve_template.ts
import { formatDate, calculateTimeToOpen } from "../utils/utils.ts";
import { htmlTemplate } from "../emailTemplate.ts";

// Sample data
const testData = {
  recipient_name: "John Doe",
  recipient_email: "john.doe@example.com",
  email_subject: "Test Email Subject",
  sender_email: "your.email@example.com",
  sent_date: formatDate(Date.now().toString()),
  time_to_open: calculateTimeToOpen(Date.now().toString()),
  read_date: formatDate(Date.now().toString()),
  email_link: "https://mail.google.com/mail/u/0/#inbox/1234567890",
};

// Function to replace placeholders in the template
function replacePlaceholders(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || '');
}

// Render the template with test data
const emailHtml = replacePlaceholders(htmlTemplate, testData);

Deno.serve(async (req) => {
  console.log("Method:", req.method);

  const url = new URL(req.url);
  console.log("Path:", url.pathname);
  console.log("Query parameters:", url.searchParams);

  console.log("Headers:", req.headers);

  if (req.body) {
    const body = await req.text();
    console.log("Body:", body);
  }

  return new Response(emailHtml, {
    headers: { "Content-Type": "text/html" },
  });
});

console.log("HTTP server is running at http://localhost:8000/");

