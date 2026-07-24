import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SermonService } from './sermon.service';
import { CreateSermonDto } from './dto/create-sermon.dto';
import { UpdateSermonDto } from './dto/update-sermon.dto';
import { SermonQueryDto } from './dto/sermon-query.dto';

@Controller('sermons')
export class SermonController {
  constructor(private readonly sermonService: SermonService) {}

  @Post()
  @UseInterceptors(FileInterceptor('thumbnail'))
  async create(
    @Body() dto: CreateSermonDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.sermonService.createSermon(dto, file);
  }

  @Get()
  async findAll(@Query() query: SermonQueryDto) {
    return this.sermonService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.sermonService.findOne(id);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('thumbnail'))
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSermonDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.sermonService.updateSermon(id, dto, file);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    return this.sermonService.remove(id);
  }
}