package it.dls.infrastructure.api.cluster;

import it.dls.application.cluster.*;
import it.dls.infrastructure.api.auth.ErrorResponse;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.net.URI;
import java.util.List;
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
            return Response.status(Response.Status.BAD_REQUEST)
                .entity(new ErrorResponse("INVALID_REQUEST", "name, bootstrapServers, securityProtocol are required"))
                .build();
        }
        try {
            var cmd = new RegisterClusterCommand(
                req.name(), req.bootstrapServers(), req.securityProtocol(),
                req.username(), req.password(), req.keystorePem(),
                req.srUrl(), req.srUsername(), req.srPassword()
            );
            var cluster = manageCluster.registerCluster(cmd);
            return Response.created(URI.create("/api/clusters/" + cluster.getId()))
                .entity(ClusterResponse.from(cluster))
                .build();
        } catch (ConnectivityValidationException e) {
            return Response.status(422)
                .entity(new ErrorResponse("CONNECTIVITY_ERROR", e.getMessage()))
                .build();
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.BAD_REQUEST)
                .entity(new ErrorResponse("INVALID_REQUEST", e.getMessage()))
                .build();
        }
    }

    @DELETE
    @Path("/{id}")
    public Response delete(@PathParam("id") UUID id) {
        try {
            manageCluster.deleteCluster(id);
            return Response.noContent().build();
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.NOT_FOUND)
                .entity(new ErrorResponse("NOT_FOUND", e.getMessage()))
                .build();
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
            return Response.status(Response.Status.BAD_REQUEST)
                .entity(new ErrorResponse("INVALID_REQUEST", "topicName, displayName, downloadMode, retentionType are required"))
                .build();
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
            return Response.status(Response.Status.BAD_REQUEST)
                .entity(new ErrorResponse("INVALID_REQUEST", e.getMessage()))
                .build();
        }
    }
}
