package it.dls.infrastructure.api.cluster;

import it.dls.application.cluster.*;
import it.dls.infrastructure.api.ProblemDetail;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Path("/api/clusters")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RolesAllowed("ADMIN")
public class ClusterResource {

    @Inject
    ManageClusterUseCase manageCluster;

    @Inject
    ManageDlqConfigUseCase manageDlqConfig;

    @GET
    public List<ClusterResponse> list() {
        return manageCluster.listClusters().stream().map(ClusterResponse::from).toList();
    }

    @POST
    public Response create(CreateClusterRequest req) {
        if (req == null || req.name() == null || req.name().isBlank()
                || req.bootstrapServers() == null || req.bootstrapServers().isBlank()
                || req.securityProtocol() == null) {
            return ProblemDetail.badRequest("name, bootstrapServers, securityProtocol are required").toResponse();
        }
        try {
            var cmd = new RegisterClusterCommand(
                req.name(), req.bootstrapServers(), req.securityProtocol(),
                false, // tlsEnabled — wired in Task 5 via CreateClusterRequest
                req.username(), req.password(), req.keystorePem(),
                req.srUrl(), req.srUsername(), req.srPassword()
            );
            var cluster = manageCluster.registerCluster(cmd);
            return Response.created(URI.create("/api/clusters/" + cluster.getId()))
                .entity(ClusterResponse.from(cluster))
                .build();
        } catch (ConnectivityValidationException e) {
            return ProblemDetail.unprocessable(e.getMessage()).toResponse();
        } catch (IllegalArgumentException e) {
            return ProblemDetail.badRequest(e.getMessage()).toResponse();
        }
    }

    @DELETE
    @Path("/{id}")
    public Response delete(@PathParam("id") UUID id) {
        try {
            manageCluster.deleteCluster(id);
            return Response.noContent().build();
        } catch (IllegalArgumentException e) {
            return ProblemDetail.notFound(e.getMessage()).toResponse();
        }
    }

    @GET
    @Path("/{id}/topics")
    public Response listTopics(@PathParam("id") UUID id) {
        try {
            var topics = manageCluster.listTopics(id);
            return Response.ok(Map.of("topics", topics)).build();
        } catch (IllegalArgumentException e) {
            return ProblemDetail.notFound(e.getMessage()).toResponse();
        } catch (RuntimeException e) {
            return ProblemDetail.unprocessable(e.getMessage()).toResponse();
        }
    }

    @GET
    @Path("/{id}/dlq-configs")
    public List<DlqConfigResponse> listDlqConfigs(@PathParam("id") UUID id) {
        return manageDlqConfig.listByCluster(id).stream().map(DlqConfigResponse::from).toList();
    }

    @POST
    @Path("/{id}/dlq-configs")
    public Response createDlqConfig(@PathParam("id") UUID clusterId, CreateDlqConfigRequest req) {
        if (req == null || req.topicName() == null || req.topicName().isBlank()
                || req.displayName() == null || req.displayName().isBlank()
                || req.downloadMode() == null || req.retentionType() == null) {
            return ProblemDetail.badRequest("topicName, displayName, downloadMode, retentionType are required").toResponse();
        }
        try {
            var cmd = new CreateDlqConfigCommand(
                req.topicName(), req.displayName(), req.downloadMode(),
                req.cronExpression(), req.batchSize(),
                req.retentionType(), req.retentionValue(), req.schemaRegistryId()
            );
            var config = manageDlqConfig.createDlqConfig(clusterId, cmd);
            return Response.created(URI.create("/api/clusters/" + clusterId + "/dlq-configs/" + config.getId()))
                .entity(DlqConfigResponse.from(config))
                .build();
        } catch (IllegalArgumentException e) {
            return ProblemDetail.badRequest(e.getMessage()).toResponse();
        }
    }

    @PUT
    @Path("/{clusterId}/dlq-configs/{configId}")
    public Response updateDlqConfig(@PathParam("clusterId") UUID clusterId,
                                    @PathParam("configId") UUID configId,
                                    UpdateDlqConfigRequest req) {
        if (req == null || req.displayName() == null || req.displayName().isBlank()
                || req.downloadMode() == null || req.retentionType() == null) {
            return ProblemDetail.badRequest("displayName, downloadMode, retentionType are required").toResponse();
        }
        try {
            var cmd = new UpdateDlqConfigCommand(
                req.displayName(), req.downloadMode(), req.cronExpression(), req.batchSize(),
                req.retentionType(), req.retentionValue(), req.schemaRegistryId(), req.defaultReplayTopic()
            );
            var config = manageDlqConfig.updateDlqConfig(configId, cmd);
            return Response.ok(DlqConfigResponse.from(config)).build();
        } catch (IllegalArgumentException e) {
            return ProblemDetail.notFound(e.getMessage()).toResponse();
        }
    }
}
