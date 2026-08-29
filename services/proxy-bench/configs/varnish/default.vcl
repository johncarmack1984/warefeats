vcl 4.1;

backend default {
    .host = "origin";
    .port = "3000";
    .connect_timeout = 5s;
    .first_byte_timeout = 10s;
    .between_bytes_timeout = 5s;
}

sub vcl_recv {
    unset req.http.Cookie;
    return (hash);
}

sub vcl_backend_response {
    if (beresp.http.Content-Type ~ "mpegurl") {
        set beresp.ttl = 2s;
        set beresp.grace = 30s;
    } else {
        set beresp.ttl = 60s;
        set beresp.grace = 30s;
    }
    set beresp.do_stream = true;
    return (deliver);
}

sub vcl_deliver {
    if (obj.hits > 0) {
        set resp.http.X-Cache = "HIT";
    } else {
        set resp.http.X-Cache = "MISS";
    }
}
