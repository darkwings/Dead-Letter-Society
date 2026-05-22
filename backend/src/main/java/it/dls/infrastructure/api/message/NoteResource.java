package it.dls.infrastructure.api.message;

import it.dls.application.inspection.AddNoteUseCase;
import it.dls.infrastructure.api.auth.ErrorResponse;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@Path("/api/messages/{messageId}/notes")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RolesAllowed({"ADMIN", "USER"})
public class NoteResource {

    @Inject AddNoteUseCase addNote;
    @Inject JsonWebToken jwt;

    @GET
    public Response list(@PathParam("messageId") UUID messageId) {
        try {
            List<NoteResponse> notes = addNote.listNotes(messageId).stream()
                .map(NoteResponse::from)
                .toList();
            return Response.ok(notes).build();
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.NOT_FOUND)
                .entity(new ErrorResponse("NOT_FOUND", e.getMessage())).build();
        }
    }

    @POST
    public Response add(@PathParam("messageId") UUID messageId, CreateNoteRequest req) {
        if (req == null || req.content() == null || req.content().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                .entity(new ErrorResponse("INVALID_REQUEST", "content is required")).build();
        }
        try {
            var note = addNote.addNote(messageId, req.content(), req.ticketReference(), currentUserId());
            return Response.created(URI.create("/api/messages/" + messageId + "/notes/" + note.getId()))
                .entity(NoteResponse.from(note))
                .build();
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.NOT_FOUND)
                .entity(new ErrorResponse("NOT_FOUND", e.getMessage())).build();
        }
    }

    private UUID currentUserId() {
        String subject = jwt.getSubject();
        if (subject == null) throw new NotAuthorizedException("Missing JWT subject");
        return UUID.fromString(subject);
    }
}
