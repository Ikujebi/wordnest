import {
  PrayerEmailTemplate,
} from './prayer-request-received';

export interface PrayerFollowUpTemplateData {
  firstName: string;
  prayerSubject: string;
  daysSinceRequest?: number;
  senderName?: string;
}

export function prayerFollowUpTemplate(
  data: PrayerFollowUpTemplateData,
): PrayerEmailTemplate {
  return {
    subject: 'Checking In: How Are You Doing With Your Prayer Request?',

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
    color:white;
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




.request-box {

    background:#fafafa;
    border:1px solid #e5e7eb;
    border-radius:10px;
    padding:20px;
    margin:25px 0;

}



.encourage-box {

    background:#fff7ed;
    border-left:5px solid #5F021F;
    padding:20px;
    margin:25px 0;

}



.label {

    font-size:12px;
    color:#6b7280;
    text-transform:uppercase;
    letter-spacing:.08em;
    font-weight:bold;

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
Prayer Ministry Follow-Up
</p>


</div>






<div class="content">


<h2>
Hello ${data.firstName},
</h2>




<p>

We hope you are doing well.

Our Prayer Ministry team wanted to check in with you regarding the prayer request you shared with us.

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





<div class="encourage-box">


<p>

We want you to know that we are still standing with you in prayer.

Whether you have received an answer, are still waiting, or simply need encouragement, we would love to hear from you.

</p>


</div>





<p>

Please feel free to update us with:

</p>



<ul>

<li>A testimony or praise report</li>

<li>Additional prayer needs</li>

<li>Any changes concerning your situation</li>

</ul>




<p>

Remember:

</p>



<p>

"Those who wait on the LORD shall renew their strength; they shall mount up with wings like eagles."

</p>


<p>

<b>
Isaiah 40:31
</b>

</p>





<p>

We are believing God with you.

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


Thank you for allowing us to pray with you.

</div>




</div>


</div>



</body>


</html>
`,
  };
}