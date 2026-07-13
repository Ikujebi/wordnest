import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { SmsService } from '../sms.service';


@Processor('sms')
export class SmsProcessor extends WorkerHost {


constructor(
 private readonly smsService: SmsService,
){
 super();
}



async process(job:Job){

 const {
  communicationId,
  recipientId,
  phone,
  content,
 } = job.data;


 return this.smsService.sendSms(
   communicationId,
   recipientId,
   phone,
   content,
 );

}


}