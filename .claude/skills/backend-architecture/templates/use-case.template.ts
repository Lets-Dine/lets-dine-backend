// application/use-cases/{action}-{feature-name}.usecase.ts
// Microservice: publish via PUB_SUB_SERVICE (NATS) as below.
// Monolith: drop the pubsub dependency and call the affected use case/service
// directly, or inject EventEmitter2 from @nestjs/event-emitter if you need
// genuinely decoupled listeners.
import { Inject, Injectable } from "@nestjs/common";
import { AuthEntity, I{Feature}, IPubSub } from "@holista/core/interfaces";
import { NotFoundException } from "@holista/core/exceptions";
import { {Action}{Feature}Dto } from "../dto/{action}-{feature-name}.dto";
import { {Feature}Repository } from "../../domain/repositories/{feature-name}.repository";
import { {FEATURE}_ERROR_MESSAGES } from "../../domain/constants";

@Injectable()
export class {Action}{Feature}Usecase {
  constructor(
    private readonly {feature}Repository: {Feature}Repository,
    @Inject("PUB_SUB_SERVICE") private readonly pubsubService: IPubSub
  ) {}

  async execute(id: number, dto: {Action}{Feature}Dto, authUser: AuthEntity): Promise<I{Feature}> {
    const existing = await this.{feature}Repository.findById(id);
    if (!existing) throw new NotFoundException({FEATURE}_ERROR_MESSAGES.NOT_FOUND);

    const updated = await this.{feature}Repository.update(id, dto);

    this.pubsubService.publish("{feature}.updated", { id, authUser });

    return updated;
  }
}
