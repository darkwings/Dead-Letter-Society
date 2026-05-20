package it.dls.application.fetch;

import jakarta.enterprise.context.ApplicationScoped;

import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@ApplicationScoped
public class FetchLockService {

    private final Set<UUID> locked = ConcurrentHashMap.newKeySet();

    public boolean isLocked(UUID id) {
        return locked.contains(id);
    }

    public boolean tryLock(UUID id) {
        return locked.add(id);
    }

    public void unlock(UUID id) {
        locked.remove(id);
    }
}
