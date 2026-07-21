import {
  PrayerEmailTemplate,
} from './prayer-request-received';

export interface PrayerRequestAssignedTemplateData {
  requesterName: string;
  prayerSubject: string;
  assignedToName: string;
  assignedByName?: string;
}

export function prayerRequestAssignedTemplate(
  data: PrayerRequestAssignedTemplateData,
): PrayerEmailTemplate {
  return {
    subject: 'Your Prayer Request Has Been Assigned to Our Prayer Team',

    html: `
<!DOCTYPE html>
<html lang="en">

<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />

<style>

body {
    margin:0;
    padding:0;
    background:#f4f4f5;
    font-family:Arial, Helvetica, sans-serif;
}

.wrapper {
    width:100%;
    padding:40px 15px;
}

.container {
    max-width:650px;
    margin:auto;
    background:#ffffff;
    border-radius:12px;
    overflow:hidden;
    border:1px solid #e5e7eb;
}

.header {
    background:#5F021F;
    color:#ffffff;
    padding:35px;
    text-align:center;
}

.header h1 {
    margin:0;
    font-size:26px;
}

.header p {
    margin-top:10px;
    opacity:.9;
}

.content {
    padding:40px;
    color:#374151;
    line-height:1.8;
}

.card {
    background:#fafafa;
    border:1px solid #e5e7eb;
    border-radius:10px;
    padding:20px;
    margin:25px 0;
}

.label {
    font-size:12px;
    text-transform:uppercase;
    color:#6b7280;
    font-weight:bold;
    letter-spacing:.08em;
}

.value {
    margin-top:5px;
    color:#111827;
    font-weight:600;
}

.team-box {
    background:#fff7ed;
    border-left:5px solid #5F021F;
    padding:20px;
    margin:25px 0;
}

.footer {
    background:#fafafa;
    padding:25px;
    text-align:center;
    color:#6b7280;
    font-size:13px;
}

</style>

</head>


<body>

<div class="wrapper">

<div class="container">


<div class="header">

<h1>
Word Tabernacle Bible Church
</h1>

<p>
Prayer Ministry Update
</p>

</div>


<div class="content">


<h2>
Hello ${data.requesterName},
</h2>


<p>

We wanted to let you know that your prayer request has been received and assigned to a member of our Prayer Ministry team.

</p>


<div class="card">

<div class="label">
Prayer Request
</div>

<div class="value">
${data.prayerSubject}
</div>

</div>



<div class="team-box">

<p>
<b>Your prayer partner:</b>
</p>

<p>
${data.assignedToName}
</p>


<p>

This member of our prayer team will be praying with you and standing in agreement with you concerning your request.

</p>

</div>



<p>

We believe that God hears every prayer and that He is working even when we cannot immediately see the answer.

</p>


<p>

If you have any updates, testimonies, or additional information regarding this prayer request, please feel free to share them with us.

</p>



<p>

May God's peace, strength, and grace continue to surround you.

</p>


<p>

Blessings,

<br />

<b>
Word Tabernacle Bible Church Prayer Ministry
</b>

</p>



</div>



<div class="footer">

© ${new Date().getFullYear()} Word Tabernacle Bible Church

<br/><br/>

"Continue steadfastly in prayer, being watchful in it with thanksgiving."

<br/>

Colossians 4:2

</div>


</div>

</div>


</body>

</html>
`,
  };
}