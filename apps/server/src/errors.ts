import { Elysia, t } from "elysia";

export abstract class HttpError extends Error {
	constructor(
		public readonly status: number,
		message: string,
	) {
		super(message);
		this.name = this.constructor.name;
	}
}

export class BadRequestError extends HttpError {
	constructor(message = "Bad Request") {
		super(400, message);
	}
}

export class UnauthorizedError extends HttpError {
	constructor(message = "Unauthorized") {
		super(401, message);
	}
}

export class ForbiddenError extends HttpError {
	constructor(message = "Forbidden") {
		super(403, message);
	}
}

export class NotFoundError extends HttpError {
	constructor(message = "Not Found") {
		super(404, message);
	}
}

export class UnprocessableEntityError extends HttpError {
	constructor(message = "Unprocessable Entity") {
		super(422, message);
	}
}

export class InternalServerError extends HttpError {
	constructor(message = "Internal Server Error") {
		super(500, message);
	}
}

export class BadGatewayError extends HttpError {
	constructor(message = "Bad Gateway") {
		super(502, message);
	}
}

export const errorModels = {
	BadRequestError: t.Object(
		{ message: t.String() },
		{ description: "The request was malformed or invalid" },
	),
	UnauthorizedError: t.Object(
		{ message: t.String() },
		{ description: "Authentication is required" },
	),
	ForbiddenError: t.Object(
		{ message: t.String() },
		{ description: "Insufficient permissions to access this resource" },
	),
	NotFoundError: t.Object(
		{ message: t.String() },
		{ description: "The requested resource was not found" },
	),
	UnprocessableEntityError: t.Object(
		{ message: t.String() },
		{ description: "The request was well-formed but contains semantic errors" },
	),
	InternalServerError: t.Object(
		{ message: t.String() },
		{ description: "An unexpected error occurred on the server" },
	),
	BadGatewayError: t.Object(
		{ message: t.String() },
		{ description: "An upstream service returned an invalid response" },
	),
};

export const errorPlugin = new Elysia({ name: "error-plugin" })
	.model(errorModels)
	.error({
		BadRequestError,
		UnauthorizedError,
		ForbiddenError,
		NotFoundError,
		UnprocessableEntityError,
		InternalServerError,
		BadGatewayError,
	})
	.onError({ as: "global" }, ({ error, set }) => {
		if (error instanceof HttpError) {
			set.status = error.status;
			return { message: error.message };
		}
	});
