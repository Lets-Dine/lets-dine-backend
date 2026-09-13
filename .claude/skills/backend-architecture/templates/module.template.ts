// {feature-name}.module.ts
import { Module } from "@nestjs/common";
import { NatsService } from "@holista/core";
import { {Feature}Service } from "./application/{feature-name}.service";
import Create{Feature}Usecase from "./application/use-cases/create-{feature-name}.usecase";
import { Update{Feature}Usecase } from "./application/use-cases/update-{feature-name}.usecase";
import { FetchAll{Feature}sUsecase } from "./application/use-cases/fetch-all-{feature-name}s.usecase";
import { {Feature}Controller } from "./interfaces/http/{feature-name}.controller";
import { {Feature}Repository } from "./domain/repositories/{feature-name}.repository";
import {Feature}RepositoryImpl from "./infrastructure/repositories/{feature-name}.repository.impl";

@Module({
  controllers: [{Feature}Controller],
  providers: [
    {Feature}Service,
    Create{Feature}Usecase,
    Update{Feature}Usecase,
    FetchAll{Feature}sUsecase,
    {Feature}RepositoryImpl,
    { provide: "PUB_SUB_SERVICE", useExisting: NatsService },
    { provide: {Feature}Repository, useExisting: {Feature}RepositoryImpl },
  ],
  exports: [{Feature}Service, { provide: {Feature}Repository, useExisting: {Feature}RepositoryImpl }],
})
export class {Feature}Module {}
