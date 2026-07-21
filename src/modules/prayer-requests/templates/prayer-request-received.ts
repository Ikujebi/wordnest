export interface PrayerRequestReceivedTemplateData {
  firstName: string;
  subject: string;
}

export interface PrayerEmailTemplate {
  subject: string;
  html: string;
}

export function prayerRequestReceivedTemplate(
  data: PrayerRequestReceivedTemplateData,
): PrayerEmailTemplate {
  return {
    subject: 'We Have Received Your Prayer Request',

    html: `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />

<style>
body{
    margin:0;
    padding:0;
    background:#f4f4f5;
    font-family:Arial,Helvetica,sans-serif;
}

.wrapper{
    width:100%;
    padding:40px 15px;
}

.container{
    max-width:650px;
    margin:auto;
    background:#ffffff;
    border-radius:12px;
    overflow:hidden;
    border:1px solid #e5e7eb;
}

.header{
    background:#5F021F;
    color:#fff;
    padding:35px;
    text-align:center;
}

.header h1{
    margin:0;
    font-size:28px;
}

.content{
    padding:40px;
    color:#374151;
    line-height:1.8;
}

.highlight{
    background:#fff7ed;
    border-left:5px solid #5F021F;
    padding:18px;
    margin:25px 0;
}

.footer{
    background:#fafafa;
    padding:25px;
    text-align:center;
    font-size:13px;
    color:#6b7280;
}

.button{
    display:inline-block;
    margin-top:25px;
    background:#5F021F;
    color:#ffffff !important;
    text-decoration:none;
    padding:14px 28px;
    border-radius:8px;
    font-weight:bold;
}

.small{
    font-size:14px;
    color:#6b7280;
}
</style>

</head>

<body>

<div class="wrapper">

<div class="container">

<div class="header">

<h1>Word Tabernacle Bible Church</h1>

<p>Prayer Ministry</p>

</div>

<div class="content">

<h2>Hello ${data.firstName},</h2>

<p>

Thank you for trusting us with your prayer request.

Your request has been received successfully by our Prayer Ministry and will be handled with care, compassion, and confidentiality.

</p>

<div class="highlight">

<strong>Prayer Request</strong>

<p>${data.subject}</p>

</div>

<p>

Our prayer team believes in the power of prayer and will be standing in faith with you.

</p>

<p>

Please remember:

</p>

<ul>

<li>Your request will remain confidential.</li>

<li>Our prayer team will begin praying as soon as possible.</li>

<li>If appropriate, a pastor or prayer team member may contact you.</li>

<li>You are never alone—God is with you.</li>

</ul>

<center>

<a
href="https://wordtabernacle.org.ng"
class="button">

Visit Our Website

</a>

</center>

<p>

"Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God."

</p>

<p>

<b>Philippians 4:6</b>

</p>

<p>

May the Lord strengthen you, comfort you and answer you according to His perfect will.

</p>

<p>

Blessings,<br>

<b>Prayer Ministry</b><br>

Word Tabernacle Bible Church

</p>

</div>

<div class="footer">

© ${new Date().getFullYear()}

Word Tabernacle Bible Church

<br><br>

This email was automatically generated after submitting a prayer request.

</div>

</div>

</div>

</body>

</html>
`,
  };
}