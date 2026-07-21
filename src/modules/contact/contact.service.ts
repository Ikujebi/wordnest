import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';

import {
  Prisma,
  Role,
  NotificationType,
} from '@prisma/client';

import { ContactRepository } from './contact.repository';

import { NotificationService } from '../notifications/notification.service';


@Injectable()
export class ContactService {

  private readonly logger =
    new Logger(ContactService.name);



  constructor(

    private readonly contactRepository: ContactRepository,

    private readonly notificationService: NotificationService,

  ) {}





  /**
   * Create new contact message
   *
   * Public website endpoint
   */
  async create(
    data: Prisma.ContactMessageCreateInput,
  ) {


    try {


      const contact =
        await this.contactRepository.create(data);



      /**
       * Notify admins
       */
      await this.notifyAdmins(contact);



      return contact;



    } catch(error){


      this.logger.error(
        'Failed creating contact message',
        error,
      );


      throw new InternalServerErrorException(
        'Unable to submit contact message',
      );

    }


  }







  /**
   * Get contacts
   */
  async findAll(
    query:any,
  ){


    return this.contactRepository.findAll(query);


  }








  /**
   * Get single contact
   */
  async findOne(
    id:string,
  ){


    const contact =
      await this.contactRepository.findById(id);



    if(!contact){

      throw new NotFoundException(
        'Contact message not found',
      );

    }



    return contact;


  }







  /**
   * Mark message as read
   */
  async markAsRead(
    id:string,
  ){


    await this.findOne(id);


    return this.contactRepository.markAsRead(id);


  }







  /**
   * Resolve contact message
   */
  async resolve(
    id:string,
    assignedToId:string,
  ){


    await this.findOne(id);



    return this.contactRepository.resolve(
      id,
      assignedToId,
    );


  }








  /**
   * Remove resolution
   */
  async unresolve(
    id:string,
  ){


    await this.findOne(id);



    return this.contactRepository.unresolve(id);


  }








  /**
   * Update contact
   */
  async update(
    id:string,
    data:Prisma.ContactMessageUpdateInput,
  ){


    await this.findOne(id);



    return this.contactRepository.update(
      id,
      data,
    );


  }








  /**
   * Soft delete
   */
  async remove(
    id:string,
  ){


    await this.findOne(id);



    return this.contactRepository.softDelete(id);


  }








  /**
   * Restore deleted contact
   */
  async restore(
    id:string,
  ){


    return this.contactRepository.restore(id);


  }








  /**
   * Permanent delete
   */
  async deletePermanent(
    id:string,
  ){


    await this.findOne(id);



    return this.contactRepository.deletePermanent(id);


  }








  /**
   * Bulk resolve
   */
  async bulkResolve(
    ids:string[],
    assignedToId:string,
  ){


    if(!ids.length){

      throw new BadRequestException(
        'No contact IDs supplied',
      );

    }



    return this.contactRepository.bulkResolve(
      ids,
      assignedToId,
    );


  }








  /**
   * Bulk delete
   */
  async bulkDelete(
    ids:string[],
  ){


    if(!ids.length){

      throw new BadRequestException(
        'No contact IDs supplied',
      );

    }



    return this.contactRepository.bulkDelete(ids);


  }








  /**
   * Restore multiple contacts
   */
  async bulkRestore(
    ids:string[],
  ){


    return this.contactRepository.bulkRestore(ids);


  }








  /**
   * Dashboard statistics
   */
  async statistics(){

    return this.contactRepository.statistics();

  }








  /**
   * Latest messages
   */
  async latest(
    limit:number = 5,
  ){


    return this.contactRepository.latest(limit);


  }









  /**
   * Notify administrators
   */
  private async notifyAdmins(
    contact:any,
  ){


    try {


      /**
       * Get admin users
       *
       * We use Prisma directly here
       * through NotificationService flow
       *
       * because repository should
       * only handle contacts.
       */


      const users =
        await this.contactRepository[
          'prisma'
        ].user.findMany({

          where:{

            role:{
              in:[
                Role.ADMIN,
                Role.SUPER_ADMIN,
              ],
            },


            isActive:true,

            deletedAt:null,

          },


          select:{
            id:true,
          },


        });





      if(!users.length){

        return;

      }






      await this.notificationService.createForUsers(

        users.map(
          user=>user.id,
        ),


        {

          title:
          'New Contact Message Received',


          message:
          `${contact.fullName} sent a new message: ${contact.subject}`,



          type:
          NotificationType.SYSTEM,


        },

      );



    } catch(error){


      /**
       * Notification failure should
       * not block contact submission
       */

      this.logger.warn(
        'Unable to notify administrators',
      );


    }


  }





}