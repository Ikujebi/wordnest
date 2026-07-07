import {
  Injectable,
  Logger,
} from '@nestjs/common';

import { PrismaService } from '../../../../prisma/prisma.service';

import {
  BadRequestException,
} from '@nestjs/common';


export interface RecipientFilter {
  type:
    | 'ALL_MEMBERS'
    | 'WORKERS'
    | 'DEPARTMENT'
    | 'MINISTRY'
    | 'INDIVIDUAL'
    | 'CUSTOM';

  departmentId?: string;

  ministryId?: string;

  memberIds?: string[];

  emails?: string[];

}



@Injectable()
export class RecipientService {

  private readonly logger =
    new Logger(RecipientService.name);



  constructor(
    private readonly prisma: PrismaService,
  ) {}





  /**
   * Resolve recipients based on filter
   */
  async resolveRecipients(
    filter: RecipientFilter,
  ) {


    switch(filter.type){


      case 'ALL_MEMBERS':

        return this.getAllMembers();



      case 'WORKERS':

        return this.getWorkers();



      case 'DEPARTMENT':

        if(!filter.departmentId){

          throw new BadRequestException(
            'Department ID required',
          );

        }

        return this.getDepartmentMembers(
          filter.departmentId,
        );



      case 'MINISTRY':

        if(!filter.ministryId){

          throw new BadRequestException(
            'Ministry ID required',
          );

        }

        return this.getMinistryMembers(
          filter.ministryId,
        );



      case 'INDIVIDUAL':

        return this.getIndividualMembers(
          filter.memberIds ?? [],
        );



      case 'CUSTOM':

        return this.getCustomRecipients(
          filter.emails ?? [],
        );



      default:

        throw new BadRequestException(
          'Invalid recipient type',
        );

    }

  }







  /**
   * Everyone with a member profile
   */
  private async getAllMembers(){


    return this.prisma.member.findMany({

      where:{

        user:{
          isActive:true,

          deletedAt:null,
        },

      },


      select:{

        id:true,

        email:true,

        phoneNumber:true,

        firstName:true,

        lastName:true,

        userId:true,

      },

    });


  }







  /**
   * Active workers
   */
  private async getWorkers(){


    return this.prisma.worker.findMany({

      where:{

        isActive:true,

        deletedAt:null,

      },


      include:{

        member:true,

      },

    });


  }








  /**
   * Department recipients
   */
  private async getDepartmentMembers(
    departmentId:string,
  ){


    return this.prisma.departmentMember.findMany({

      where:{

        departmentId,

        status:'ACTIVE',

        member:{
          user:{
            isActive:true,
          },
        },

      },


      include:{

        member:true,

      },

    });


  }








  /**
   * Ministry recipients
   */
  private async getMinistryMembers(
    ministryId:string,
  ){


    return this.prisma.worker.findMany({

      where:{

        ministryId,

        isActive:true,

      },


      include:{

        member:true,

      },

    });


  }








  /**
   * Specific members
   */
  private async getIndividualMembers(
    ids:string[],
  ){


    if(!ids.length){

      return [];

    }


    return this.prisma.member.findMany({

      where:{

        id:{
          in:ids,
        },

      },


      select:{

        id:true,

        email:true,

        phoneNumber:true,

        firstName:true,

        lastName:true,

        userId:true,

      },

    });


  }








  /**
   * External newsletter subscribers
   */
  private async getCustomRecipients(
    emails:string[],
  ){


    return emails.map(
      email=>({

        id:null,

        email,

        phoneNumber:null,

        firstName:null,

        lastName:null,

        userId:null,

      }),
    );


  }








  /**
   * Add recipients to communication
   */
  async attachRecipients(
    communicationId:string,
    recipients:any[],
  ){


    if(!recipients.length){

      return {
        count:0,
      };

    }



    const data =
      recipients.map(
        recipient=>({

          communicationId,


          memberId:
            recipient.id
              ??
            null,


          email:
            recipient.email
              ??
            null,


          phone:
            recipient.phoneNumber
              ??
            null,

        }),
      );



    await this.prisma.communicationRecipient.createMany({

      data,

      skipDuplicates:true,

    });



    return {

      count:data.length,

    };

  }








  /**
   * Preview recipient count
   */
  async countRecipients(
    filter:RecipientFilter,
  ){

    const recipients =
      await this.resolveRecipients(
        filter,
      );


    return {

      count:
        recipients.length,

    };

  }





  /**
   * Remove duplicates
   */
  removeDuplicates(
    recipients:any[],
  ){


    const map =
      new Map();


    for(
      const recipient of recipients
    ){

      const key =
        recipient.email
        ??
        recipient.phoneNumber;


      if(key){

        map.set(
          key,
          recipient,
        );

      }

    }


    return Array.from(
      map.values(),
    );

  }



}