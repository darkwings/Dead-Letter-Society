package it.dls.infrastructure.api.replay;

import it.dls.application.replay.ReplayMessageUseCase;
import it.dls.application.replay.ReplayTopicNotResolvableException;
import it.dls.application.replay.SchemaValidationException;
import it.dls.domain.cluster.KafkaCluster;
import it.dls.domain.cluster.KafkaClusterRepository;
import it.dls.domain.cluster.SchemaRegistryAuthConfig;
import it.dls.domain.dlqconfig.DlqConfigRepository;
import it.dls.domain.message.DlqMessage;
import it.dls.domain.message.MessageRepository;
import it.dls.domain.shared.EncryptionPort;
import it.dls.domain.shared.SchemaRegistryPort;
import it.dls.infrastructure.api.auth.ErrorResponse;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;

import java.util.UUID;

@Path("/api/messages/{id}")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RolesAllowed({"ADMIN", "USER"})
public class ReplayResource {

    @Inject ReplayMessageUseCase replayUseCase;
    @Inject MessageRepository messageRepo;
    @Inject DlqConfigRepository configRepo;
    @Inject KafkaClusterRepository clusterRepo;
    @Inject SchemaRegistryPort schemaRegistry;
    @Inject EncryptionPort encryption;
    @Inject JsonWebToken jwt;

    @POST
    @Path("/replay")
    public Response replay(@PathParam("id") UUID messageId, ReplayRequest req) {
        try {
            var body = req != null ? req : new ReplayRequest(null, null);
            var result = replayUseCase.replay(messageId, body.targetTopicOverride(),
                body.editedPayload(), currentUserId());
            return result.success()
                ? Response.ok(result).build()
                : Response.status(422).entity(result).build();
        } catch (ReplayTopicNotResolvableException e) {
            return Response.status(Response.Status.BAD_REQUEST)
                .entity(new ErrorResponse("TOPIC_NOT_RESOLVABLE", e.getMessage())).build();
        } catch (SchemaValidationException e) {
            return Response.status(422)
                .entity(new ErrorResponse("SCHEMA_VALIDATION_FAILED", e.getMessage())).build();
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.NOT_FOUND)
                .entity(new ErrorResponse("NOT_FOUND", e.getMessage())).build();
        }
    }

    @POST
    @Path("/validate-payload")
    public Response validatePayload(@PathParam("id") UUID messageId, ValidatePayloadRequest req) {
        if (req == null || req.payload() == null) {
            return Response.status(Response.Status.BAD_REQUEST)
                .entity(new ErrorResponse("INVALID_REQUEST", "payload is required")).build();
        }
        DlqMessage msg = messageRepo.findById(messageId).orElse(null);
        if (msg == null) {
            return Response.status(Response.Status.NOT_FOUND)
                .entity(new ErrorResponse("NOT_FOUND", "Message not found: " + messageId)).build();
        }
        if (msg.getSchemaId() == null) {
            return Response.ok(new ValidatePayloadResponse(true, null)).build();
        }
        KafkaCluster cluster = resolveCluster(msg);
        if (cluster == null || cluster.getSchemaRegistry() == null) {
            return Response.ok(new ValidatePayloadResponse(true, null)).build();
        }
        var srAuth = decryptAuth(cluster.getSchemaRegistry().authConfig());
        var result = schemaRegistry.validate(req.payload(), msg.getSchemaId(),
            cluster.getSchemaRegistry().url(), srAuth);
        return Response.ok(new ValidatePayloadResponse(result.valid(), result.error())).build();
    }

    private KafkaCluster resolveCluster(DlqMessage msg) {
        return configRepo.findById(msg.getDlqConfigId())
            .flatMap(c -> clusterRepo.findById(c.getClusterId()))
            .orElse(null);
    }

    private SchemaRegistryAuthConfig decryptAuth(SchemaRegistryAuthConfig enc) {
        if (!enc.hasCredentials()) return SchemaRegistryAuthConfig.none();
        return new SchemaRegistryAuthConfig(
            encryption.decrypt(enc.encryptedUsername()),
            encryption.decrypt(enc.encryptedPassword())
        );
    }

    private UUID currentUserId() {
        return UUID.fromString(jwt.getSubject());
    }
}
