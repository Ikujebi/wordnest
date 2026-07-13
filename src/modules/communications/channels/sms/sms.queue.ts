import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';


@Injectable()
export class SmsQueueService {

  constructor(
    @InjectQueue('sms')
    private readonly smsQueue: Queue,
  ){}


  async addSmsJob(data:{
    communicationId:string;
    recipientId:string;
    phone:string;
    content:string;
  }){

    await this.smsQueue.add(
      'send-sms',
      data,
      {
        attempts:3,

        backoff:{
          type:'exponential',
          delay:5000,
        },

        removeOnComplete:true,

        removeOnFail:false,
      },
    );

  }

}