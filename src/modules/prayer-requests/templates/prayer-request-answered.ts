import {
  PrayerEmailTemplate,
} from './prayer-request-received';

export interface PrayerRequestAnsweredTemplateData {
  firstName: string;
  prayerSubject: string;
  testimony?: string;
}

export function prayerRequestAnsweredTemplate(
  data: PrayerRequestAnsweredTemplateData,
): PrayerEmailTemplate {
  return {
    subject: 'Praise Report: Your Prayer Request Has Been Answered',

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
    padding:40px;
    text-align:center;

}


.header h1 {

    margin:0;
    font-size:28px;

}



.content {

    padding:40px;
    color:#374151;
    line-height:1.8;

}



.success-box {

    background:#ecfdf5;
    border-left:5px solid #059669;
    padding:20px;
    margin:25px 0;

}



.request-box {

    background:#fafafa;
    border:1px solid #e5e7eb;
    border-radius:10px;
    padding:20px;
    margin:25px 0;

}



.label {

    font-size:12px;
    font-weight:bold;
    color:#6b7280;
    text-transform:uppercase;
    letter-spacing:.08em;

}



.value {

    margin-top:8px;
    color:#111827;
    font-weight:600;

}



.testimony {

    background:#fff7ed;
    border-left:5px solid #5F021F;
    padding:20px;
    margin-top:25px;

}



.footer {

    background:#fafafa;
    text-align:center;
    padding:25px;
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
Prayer Ministry Praise Report
</p>

</div>




<div class="content">


<h2>
Hello ${data.firstName},
</h2>



<p>

We rejoice with you and give thanks to God for His faithfulness.

Your prayer request has been marked as answered, and we celebrate this testimony with you.

</p>




<div class="success-box">

<strong>
Hallelujah! God Answers Prayer.
</strong>


<p>

We thank God for His mercy, power, and perfect timing concerning your request.

</p>

</div>





<div class="request-box">


<div class="label">
Prayer Request
</div>


<div class="value">
${data.prayerSubject}
</div>


</div>





${
  data.testimony
    ? `

<div class="testimony">

<div class="label">
Testimony / Praise Report
</div>


<p>

${data.testimony}

</p>


</div>

`
    : ''
}





<p>

Thank you for allowing our Prayer Ministry to stand with you in faith.

We encourage you to continue trusting God and sharing His goodness with others.

</p>



<p>

"Give thanks to the LORD, for He is good; His love endures forever."

</p>


<p>

<b>
Psalm 118:1
</b>

</p>




<p>

May your testimony continue to glorify God and strengthen the faith of others.

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

Thank you for sharing your prayer journey with us.

</div>



</div>


</div>


</body>


</html>
`,
  };
}