import { Transform, Type } from "class-transformer";
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength
} from "class-validator";

export class CreateWorkspaceDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @Transform(({ value }: { value: string }) => value.toLowerCase())
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(120)
  slug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;
}

export class UpdateWorkspaceDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;
}

export class InviteMemberDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  roleId!: string;
}

export class InvitationTokenDto {
  @IsString()
  @MinLength(32)
  token!: string;
}

export class UpdateMemberRoleDto {
  @IsUUID()
  roleId!: string;
}

export class MembershipIdParamDto {
  @IsUUID()
  membershipId!: string;
}

export class ListMembersQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit = 25;
}
