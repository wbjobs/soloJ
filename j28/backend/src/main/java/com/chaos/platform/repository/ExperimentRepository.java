package com.chaos.platform.repository;

import com.chaos.platform.entity.Experiment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ExperimentRepository extends JpaRepository<Experiment, Long> {

    Optional<Experiment> findByExperimentId(String experimentId);

    Page<Experiment> findByStatus(String status, Pageable pageable);

    Page<Experiment> findByCreatorId(Long creatorId, Pageable pageable);

    List<Experiment> findByStatusIn(List<String> statuses);

    @Query("SELECT COUNT(e) FROM Experiment e WHERE e.status = ?1")
    Long countByStatus(String status);

    @Query("SELECT e.chaosType, COUNT(e) FROM Experiment e GROUP BY e.chaosType")
    List<Object[]> countByChaosType();

    boolean existsByExperimentId(String experimentId);
}
