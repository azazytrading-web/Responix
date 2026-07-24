import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthRepository } from "./auth.repository";
import { AuthService } from "./auth.service";
import { JwtAuthGuard, PermissionsGuard } from "./auth.guard";
import { TenantModule } from "../tenant/tenant.module";

@Module({
  imports: [JwtModule.register({}), TenantModule],
  controllers: [AuthController],
  providers: [AuthRepository, AuthService, JwtAuthGuard, PermissionsGuard],
  exports: [JwtAuthGuard, PermissionsGuard]
})
export class AuthModule {}
