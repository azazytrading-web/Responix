import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PromptLibraryController } from "./prompt-library.controller";
import {
  CreatePromptDto,
  PromptListQueryDto,
  RollbackPromptDto,
  UpdatePromptDraftDto
} from "./dto/prompt-library.dto";

describe("PromptLibraryController validation and permissions", () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true
  });

  const transform = (value: object, metatype: new () => object) =>
    pipe.transform(value, { type: "body", metatype });

  it("accepts valid prompt content and typed variable metadata", async () => {
    await expect(
      transform(
        {
          name: "Welcome",
          slug: "welcome-message",
          draft: { body: "Hello {{customer_name}}" },
          variables: [
            {
              name: "customer_name",
              type: "string",
              required: true,
              description: "Customer display name"
            }
          ]
        },
        CreatePromptDto
      )
    ).resolves.toBeInstanceOf(CreatePromptDto);
  });

  it.each([
    [{ name: "Welcome", slug: "Not Valid" }, CreatePromptDto],
    [{ draft: {}, tagIds: ["not-a-uuid"] }, UpdatePromptDraftDto],
    [{ revision: 0 }, RollbackPromptDto],
    [{ name: "Welcome", slug: "welcome", unexpected: true }, CreatePromptDto]
  ])("rejects invalid request payload %#", async (payload, metatype) => {
    await expect(transform(payload, metatype)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("transforms and validates list pagination, filters, and sorting", async () => {
    const query = (await pipe.transform(
      {
        page: "2",
        limit: "50",
        favorite: "true",
        archived: "false",
        tagIds:
          "4b63cf22-bde9-4ab3-91a0-6eb153ed1294,ad0ed78e-4097-4489-a89a-4e5d0c90139a",
        sortBy: "name",
        sortOrder: "asc"
      },
      { type: "query", metatype: PromptListQueryDto }
    )) as PromptListQueryDto;
    expect(query).toMatchObject({
      page: 2,
      limit: 50,
      favorite: true,
      archived: false,
      sortBy: "name",
      sortOrder: "asc"
    });
    expect(query.tagIds).toHaveLength(2);
  });

  it("declares dedicated permissions for read, publish, rollback, archive, and taxonomy", () => {
    const reflector = new Reflector();
    /* eslint-disable @typescript-eslint/unbound-method */
    expect(reflector.get("permissions", PromptLibraryController.prototype.list)).toEqual([
      "prompt.library.read"
    ]);
    expect(reflector.get("permissions", PromptLibraryController.prototype.publish)).toEqual([
      "prompt.library.publish"
    ]);
    expect(reflector.get("permissions", PromptLibraryController.prototype.rollback)).toEqual([
      "prompt.library.rollback"
    ]);
    expect(reflector.get("permissions", PromptLibraryController.prototype.archive)).toEqual([
      "prompt.library.archive"
    ]);
    expect(reflector.get("permissions", PromptLibraryController.prototype.createCategory)).toEqual([
      "prompt.library.manage"
    ]);
    /* eslint-enable @typescript-eslint/unbound-method */
  });
});
