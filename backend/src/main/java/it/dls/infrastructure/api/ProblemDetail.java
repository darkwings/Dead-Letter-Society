package it.dls.infrastructure.api;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.ws.rs.core.Response;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ProblemDetail(
    String type,
    String title,
    int status,
    String detail,
    List<FieldViolation> violations
) {
    public record FieldViolation(String field, String message) {}

    public Response toResponse() {
        return Response.status(status)
            .entity(this)
            .type("application/problem+json")
            .build();
    }

    public static ProblemDetail of(int status, String slug, String title, String detail) {
        return new ProblemDetail("https://dls.io/errors/" + slug, title, status, detail, null);
    }

    public static ProblemDetail notFound(String detail) {
        return of(404, "not-found", "Not Found", detail);
    }

    public static ProblemDetail badRequest(String detail) {
        return of(400, "bad-request", "Bad Request", detail);
    }

    public static ProblemDetail conflict(String detail) {
        return of(409, "conflict", "Conflict", detail);
    }

    public static ProblemDetail unprocessable(String detail) {
        return of(422, "unprocessable-entity", "Unprocessable Entity", detail);
    }

    public static ProblemDetail forbidden(String detail) {
        return of(403, "forbidden", "Forbidden", detail);
    }

    public static ProblemDetail unauthorized(String detail) {
        return of(401, "unauthorized", "Unauthorized", detail);
    }

    public static ProblemDetail internalError(String detail) {
        return of(500, "internal-server-error", "Internal Server Error", detail);
    }

    public static ProblemDetail withViolations(String detail, List<FieldViolation> violations) {
        return new ProblemDetail(
            "https://dls.io/errors/validation-error",
            "Validation Error", 422, detail, violations
        );
    }
}
