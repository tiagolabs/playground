package io.lab.identity;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import io.quarkus.test.common.QuarkusTestResourceLifecycleManager;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.*;

public class MockKeycloak implements QuarkusTestResourceLifecycleManager {
    static final String USER="6bc9a56b-f82c-4da4-b14f-00c36f7dc002";
    static final String ADMIN="6bc9a56b-f82c-4da4-b14f-00c36f7dc001";
    static final ObjectMapper JSON=new ObjectMapper();
    static final Map<String,JsonNode> users=new HashMap<>();
    static final Set<String> grants=new HashSet<>();
    static final List<String> writes=new ArrayList<>();
    static JsonNode lastCreated;
    static boolean mailFails;
    HttpServer server;
    static synchronized void reset() {
        users.clear();grants.clear();writes.clear();mailFails=false;lastCreated=null;
        for (String id:List.of(USER,ADMIN)) users.put(id,JSON.createObjectNode().put("id",id).put("username",id.equals(ADMIN)?"lab-admin":"member")
            .put("email",id.equals(ADMIN)?"lab-admin@example.test":"member@example.test").put("firstName","Lab").put("lastName","User").put("enabled",true).put("emailVerified",true));
    }
    public Map<String,String> start() {
        reset();
        try {
            server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
            server.createContext("/",exchange->{
                String path=exchange.getRequestURI().getPath();String query=exchange.getRequestURI().getQuery();String method=exchange.getRequestMethod();
                String raw=new String(exchange.getRequestBody().readAllBytes(),StandardCharsets.UTF_8);
                JsonNode input=(raw.startsWith("{") || raw.startsWith("[")) ? JSON.readTree(raw) : JSON.nullNode();
                int status=200;JsonNode result=JSON.nullNode();
                synchronized(MockKeycloak.class) {
                    if (path.endsWith("/certs")) result=JSON.createObjectNode().set("keys",JSON.createArrayNode());
                    else if (path.endsWith("/token")) result=JSON.createObjectNode().put("access_token","mock-private-token").put("expires_in",300);
                    else if (!"Bearer mock-private-token".equals(exchange.getRequestHeaders().getFirst("Authorization"))) status=401;
                    else {
                        path=path.substring("/admin/realms/lab".length());
                        if (!method.equals("GET")) writes.add(method+" "+path);
                        if (path.equals("/clients")) {
                            String client=query.substring("clientId=".length());
                            result=JSON.createArrayNode().add(JSON.createObjectNode().put("id","client-"+client).put("clientId",client));
                        } else if (path.startsWith("/clients/") && path.endsWith("/roles/app-user")) result=JSON.createObjectNode().put("id","role-app-user").put("name","app-user");
                        else if (path.equals("/users")) {
                            if (method.equals("POST")) {
                                if (users.values().stream().anyMatch(u->u.path("username").asText().equals(input.path("username").asText()))) status=409;
                                else {lastCreated=input.deepCopy();var created=((com.fasterxml.jackson.databind.node.ObjectNode)input.deepCopy()).put("id",USER);users.put(USER,created);status=201;}
                            } else if (query!=null && query.contains("exact=true")) result=JSON.createArrayNode().add(users.get(USER));
                            else {var array=JSON.createArrayNode();users.values().forEach(array::add);result=array;}
                        } else if (path.startsWith("/users/")) {
                            String[] parts=path.split("/");String id=parts[2];
                            if (!users.containsKey(id)) status=404;
                            else if (parts.length==3) {
                                if (method.equals("PUT")) {var updated=(com.fasterxml.jackson.databind.node.ObjectNode)users.get(id);input.fields().forEachRemaining(e->updated.set(e.getKey(),e.getValue()));status=204;}
                                else result=users.get(id);
                            } else if (path.contains("/role-mappings/clients/")) {
                                String client=parts[5];String key=id+":"+client;
                                if (method.equals("GET")) {var roles=JSON.createArrayNode();if (client.equals("client-lab-identity-api") || grants.contains(key)) roles.add(JSON.createObjectNode().put("name","app-user"));result=roles;}
                                else {if (method.equals("POST"))grants.add(key);else grants.remove(key);status=204;}
                            } else if (path.endsWith("/execute-actions-email")) {status=mailFails?500:204;result=JSON.createObjectNode().put("secret","upstream-private-material");}
                            else if (path.endsWith("/logout")) status=204;
                            else status=404;
                        } else status=404;
                    }
                }
                byte[] bytes=result.toString().getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type","application/json");
                exchange.sendResponseHeaders(status,status==204?-1:bytes.length);
                if(status!=204)exchange.getResponseBody().write(bytes);exchange.close();
            });
            server.start();return Map.of("lab.keycloak.url","http://127.0.0.1:"+server.getAddress().getPort());
        } catch(Exception failure){throw new RuntimeException(failure);}
    }
    public void stop(){if(server!=null)server.stop(0);}
}
