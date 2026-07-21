import {
  PrayerEmailTemplate,
} from './prayer-request-received';

export interface PrayerTeamNoteTemplateData {
  firstName: string;
  prayerSubject: string;
  message: string;
  senderName?: string;
}

export function prayerTeamNoteTemplate(
  data: PrayerTeamNoteTemplateData,
): PrayerEmailTemplate {
  return {
    subject: 'A Message From Our Prayer Ministry Team',

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
    font-size:27px;

}



.content {

    padding:40px;
    color:#374151;
    line-height:1.8;

}



.message-box {

    background:#fafafa;
    border:1px solid #e5e7eb;
    border-radius:12px;
    padding:25px;
    margin:25px 0;

}



.request-box {

    background:#fff7ed;
    border-left:5px solid #5F021F;
    padding:18px;
    margin:25px 0;

}



.label {

    font-size:12px;
    text-transform:uppercase;
    font-weight:bold;
    color:#6b7280;
    letter-spacing:.08em;

}



.footer {

    background:#fafafa;
    padding:25px;
    text-align:center;
    font-size:13px;
    color:#6b7280;

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
Prayer Ministry Care Message
</p>


</div>





<div class="content">


<h2>
Hello ${data.firstName},
</h2>



<p>

We wanted to personally encourage you and remind you that you are not walking through this season alone.

Our Prayer Ministry team has been praying with you concerning your request.

</p>




<div class="request-box">


<div class="label">
Prayer Request
</div>


<p>

<strong>
${data.prayerSubject}
</strong>

</p>


</div>






<div class="message-box">


<div class="label">
Message From The Prayer Team
</div>



<p>

${data.message}

</p>



</div>






<p>

We encourage you to continue standing in faith and trusting God's promises.

</p>



<p>

"Cast all your anxiety on Him because He cares for you."

</p>


<p>

<b>
1 Peter 5:7
</b>

</p>




<p>

May the Lord strengthen you, guide you, and fill your heart with peace.

</p>




<p>

With love and prayers,

<br/><br/>

<b>

${data.senderName || 'Prayer Ministry Team'}

</b>

<br/>

Word Tabernacle Bible Church

</p>



</div>





<div class="footer">


© ${new Date().getFullYear()} Word Tabernacle Bible Church


<br/><br/>


This message was sent by the Prayer Ministry.

</div>



</div>


</div>


</body>


</html>
`,
  };
}