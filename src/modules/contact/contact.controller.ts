import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ContactService } from './contact.service';
import { CreateContactDto } from './dto/create-contact.dto';

@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  /**
   * Public endpoint
   */
  @Post()
  async create(@Body() dto: CreateContactDto) {
    return this.contactService.create(dto);
  }

  /**
   * Admin endpoint
   */
  @Get()
  async findAll() {
    return this.contactService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.contactService.findOne(id);
  }

  @Patch(':id/resolve')
  async resolve(@Param('id') id: string) {
    /**
     * Replace with logged in admin id
     */
    const adminId = 'CURRENT_ADMIN_ID';

    return this.contactService.resolve(id, adminId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.contactService.delete(id);
  }
}