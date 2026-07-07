import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class StatisticsService {

  private readonly logger =
    new Logger(StatisticsService.name);


  constructor(
    private readonly prisma: PrismaService,
  ) {}



  /**
   * Get complete communication statistics
   */
  async getCommunicationStatistics(
    communicationId: string,
  ) {


    const communication =
      await this.prisma.communication.findUnique({

        where: {
          id: communicationId,
        },

      });



    if (!communication) {

      throw new NotFoundException(
        'Communication not found',
      );

    }



    const [
      totalRecipients,
      totalSent,
      totalFailed,
      channelStats,
    ] =
      await Promise.all([


        this.getTotalRecipients(
          communicationId,
        ),


        this.getSuccessfulDeliveries(
          communicationId,
        ),


        this.getFailedDeliveries(
          communicationId,
        ),


        this.getChannelStatistics(
          communicationId,
        ),


      ]);




    const deliveryRate =
      totalRecipients === 0
        ? 0
        :
        Number(
          (
            (totalSent / totalRecipients)
            *
            100
          )
          .toFixed(2),
        );



    return {

      communicationId,

      title:
        communication.title,


      status:
        communication.status,


      totalRecipients,


      successfulDeliveries:
        totalSent,


      failedDeliveries:
        totalFailed,


      deliveryRate,


      channelStats,


      createdAt:
        communication.createdAt,


      sentAt:
        communication.sentAt,

    };

  }







  /**
   * Total recipients
   */
  async getTotalRecipients(
    communicationId:string,
  ) {


    return this.prisma.communicationRecipient.count({

      where:{
        communicationId,
      },

    });

  }







  /**
   * Successful messages
   */
  async getSuccessfulDeliveries(
    communicationId:string,
  ) {


    return this.prisma.communicationLog.count({

      where:{

        communicationId,

        success:true,

      },

    });

  }







  /**
   * Failed messages
   */
  async getFailedDeliveries(
    communicationId:string,
  ) {


    return this.prisma.communicationLog.count({

      where:{

        communicationId,

        success:false,

      },

    });

  }







  /**
   * Breakdown by channel
   */
  async getChannelStatistics(
    communicationId:string,
  ) {


    const logs =
      await this.prisma.communicationLog.groupBy({

        by:[
          'channel',
          'success',
        ],


        where:{
          communicationId,
        },


        _count:{
          _all:true,
        },


      });



    const result:any = {};



    for(
      const item of logs
    ){


      const channel =
        item.channel;



      if(!result[channel]){

        result[channel]={
          sent:0,
          failed:0,
        };

      }



      if(item.success){

        result[channel].sent =
          item._count._all;

      }
      else{

        result[channel].failed =
          item._count._all;

      }

    }



    return result;

  }







  /**
   * Recent communication history
   */
  async recentCommunications(
    limit:number = 10,
  ) {


    return this.prisma.communication.findMany({

      take:limit,


      orderBy:{
        createdAt:'desc',
      },


      select:{

        id:true,

        title:true,

        type:true,

        status:true,

        createdAt:true,

        sentAt:true,

      },

    });

  }







  /**
   * Dashboard overview
   */
  async dashboardOverview() {


    const [
      total,
      sent,
      scheduled,
      failed,
    ] =
      await Promise.all([


        this.prisma.communication.count(),


        this.prisma.communication.count({

          where:{
            status:'SENT',
          },

        }),


        this.prisma.communication.count({

          where:{
            status:'SCHEDULED',
          },

        }),


        this.prisma.communication.count({

          where:{
            status:'FAILED',
          },

        }),


      ]);



    return {

      totalCommunications:
        total,


      sentCommunications:
        sent,


      scheduledCommunications:
        scheduled,


      failedCommunications:
        failed,

    };

  }







  /**
   * Future email analytics support
   */
  async trackEmailOpen(
    communicationId:string,
    recipientId:string,
  ) {


    this.logger.log(
      `Email opened: ${communicationId} - ${recipientId}`,
    );


    // Later:
    // update CommunicationRecipient
    // openedAt = new Date()


    return {
      tracked:true,
    };

  }







  /**
   * Future link tracking support
   */
  async trackClick(
    communicationId:string,
    recipientId:string,
  ) {


    this.logger.log(
      `Link clicked: ${communicationId} - ${recipientId}`,
    );


    return {
      tracked:true,
    };

  }


}