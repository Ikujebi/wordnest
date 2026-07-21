import { Injectable, Logger } from '@nestjs/common';

import { EmailService } from '../communications/channels/email.service';

import {
  prayerRequestReceivedTemplate,
} from './templates/prayer-request-received';

import {
  prayerRequestAssignedTemplate,
} from './templates/prayer-request-assigned';

import {
  prayerRequestAnsweredTemplate,
} from './templates/prayer-request-answered';

import {
  prayerTeamNoteTemplate,
} from './templates/prayer-team-note';

import {
  prayerFollowUpTemplate,
} from './templates/prayer-follow-up';


import { PrayerRequest } from '@prisma/client';


@Injectable()
export class PrayerCommunicationService {

  private readonly logger = new Logger(
    PrayerCommunicationService.name,
  );


  constructor(
    private readonly emailService: EmailService,
  ) {}



  /**
   * Send confirmation after a user submits a prayer request
   */
  async sendRequestReceivedEmail(
    prayer: PrayerRequest,
  ) {

    if (!prayer.email) {
      this.logger.warn(
        `Prayer request ${prayer.id} has no email address`,
      );

      return;
    }


    const template =
      prayerRequestReceivedTemplate({

        firstName:
          prayer.firstName || 'Friend',

        subject:
          prayer.subject,

      });



    await this.emailService.send({

      to: prayer.email,

      subject:
        template.subject,

      html:
        template.html,

    });



    this.logger.log(
      `Prayer received email sent to ${prayer.email}`,
    );

  }





  /**
   * Notify requester when prayer request
   * has been assigned to a prayer worker
   */
  async sendAssignedEmail(
    prayer: PrayerRequest,
    assignedToName: string,
  ) {


    if (!prayer.email) {
      return;
    }



    const template =
      prayerRequestAssignedTemplate({

        requesterName:
          prayer.firstName || 'Friend',

        prayerSubject:
          prayer.subject,

        assignedToName,

      });



    await this.emailService.send({

      to: prayer.email,

      subject:
        template.subject,

      html:
        template.html,

    });



    this.logger.log(
      `Prayer assignment email sent`,
    );

  }





  /**
   * Send answered prayer testimony email
   */
  async sendAnsweredEmail(
    prayer: PrayerRequest,
  ) {


    if (!prayer.email) {
      return;
    }



    const template =
      prayerRequestAnsweredTemplate({

        firstName:
          prayer.firstName || 'Friend',

        prayerSubject:
          prayer.subject,

        testimony:
          prayer.testimony || undefined,

      });



    await this.emailService.send({

      to: prayer.email,

      subject:
        template.subject,

      html:
        template.html,

    });



    this.logger.log(
      `Answered prayer email sent`,
    );

  }






  /**
   * Send a personal message from prayer team/pastor
   */
  async sendPrayerTeamNoteEmail(
    prayer: PrayerRequest,
    message: string,
    senderName?: string,
  ) {


    if (!prayer.email) {
      return;
    }




    const template =
      prayerTeamNoteTemplate({

        firstName:
          prayer.firstName || 'Friend',

        prayerSubject:
          prayer.subject,

        message,

        senderName,

      });





    await this.emailService.send({

      to:
        prayer.email,

      subject:
        template.subject,

      html:
        template.html,

    });



    this.logger.log(
      `Prayer team note sent`,
    );

  }






  /**
   * Automated pastoral follow-up
   */
  async sendFollowUpEmail(
    prayer: PrayerRequest,
  ) {


    if (!prayer.email) {
      return;
    }




    const template =
      prayerFollowUpTemplate({

        firstName:
          prayer.firstName || 'Friend',

        prayerSubject:
          prayer.subject,

      });





    await this.emailService.send({

      to:
        prayer.email,

      subject:
        template.subject,

      html:
        template.html,

    });



    this.logger.log(
      `Prayer follow-up sent`,
    );

  }






  /**
   * Notify prayer team members internally
   */
  async notifyPrayerTeam(
    prayer: PrayerRequest,
    teamEmails: string[],
  ) {


    const emails =
      teamEmails.map(
        (email) => ({

          to: email,

          subject:
            `New Prayer Request - ${prayer.subject}`,

          html: `

          <h2>
          New Prayer Request Received
          </h2>

          <p>
          <strong>Name:</strong>
          ${prayer.firstName}
          ${prayer.lastName}
          </p>


          <p>
          <strong>Subject:</strong>
          ${prayer.subject}
          </p>


          <p>
          ${prayer.message}
          </p>

          `,

        }),
      );



    await this.emailService.sendBulk(
      emails,
    );


    this.logger.log(
      `Prayer team notified`,
    );

  }

}